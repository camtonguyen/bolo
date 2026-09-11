import { ensureFontsLoaded, assertFontsReady, palette } from '../theme/palette';
import { SUSPECTS, JURISDICTION, type SuspectId } from '../data/suspects';
import type { ControlNumber } from '../lib/brand';
import { LOOKS, type LookId } from './looks';
import { gradeOffThread } from './grade/gradeOffThread';
import { STAMPS, type OverlayId } from '../assets/stamps';
import { drawOverlay, type OverlayPlacement } from './overlays';

export type { LookId };
export const LOOK_IDS = Object.keys(LOOKS) as readonly LookId[];

export type { OverlayId, OverlayPlacement };
export const OVERLAY_IDS = Object.keys(STAMPS) as readonly OverlayId[];

/**
 * Fully serializable. The scoring engine reads this, the board re-renders
 * from it, and localStorage round-trips it. Every visual decision must be
 * reconstructible from this object alone. `version` lets a future parser
 * tell an old persisted shape apart from a corrupt one.
 */
export interface CompositeConfig {
  readonly version: 1;
  readonly look: LookId;
  readonly overlays: readonly OverlayPlacement[];
  readonly bountyText: string;
  /**
   * Swap the portrait for another suspect's while keeping this record's own
   * fields (name, charge, control number). Framing someone else, not hiding
   * yourself.
   */
  readonly substitutedPortrait: SuspectId | null;
}

// The document canvas is a fixed size independent of the source portrait's
// resolution -- the portrait is fitted into its window, never stretched to
// fill it -- so this comfortably clears the grading pipeline's 1600px cap (MAX_GRADE_EDGE) on its own.
const WIDTH = 1000;
const HEIGHT = 1360;

const WINDOW = { x: 300, y: 400, width: 400, height: 500 } as const;

// Exported so scoring/markerCoverage.ts can project a marker's portrait-space
// region into the same plate-normalized space overlays already use, with the
// exact fit math drawPortrait() below uses -- not a second, drifting copy.
export const PLATE_WIDTH = WIDTH;
export const PLATE_HEIGHT = HEIGHT;
export const PORTRAIT_WINDOW = WINDOW;

/**
 * Portrait -> official bulletin plate -> data URL for <ImageEditor image={...} />.
 *
 * All custom art direction lives here because the SDK exposes no hook for
 * stickers, fonts, colours or filter presets.
 */
export async function composite(
  portrait: Blob,
  suspect: SuspectId,
  config: CompositeConfig,
  controlNumber: ControlNumber,
): Promise<string> {
  await ensureFontsLoaded();

  const image = await loadImage(portrait);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  drawPlate(ctx);
  drawPortrait(ctx, image);

  await applyLook(ctx, config.look);
  drawFields(ctx, suspect, config.bountyText, controlNumber);

  // Drawn last, on top of the finished document -- a stamp that looks freshly
  // affixed is the point, not a flaw. Sequential so array order is z-order.
  for (const placement of config.overlays) {
    await drawOverlay(ctx, placement, WIDTH, HEIGHT);
  }

  return canvas.toDataURL('image/png');
}

/** Paper stock, outer rule, letterhead, and the empty portrait window frame. */
function drawPlate(ctx: CanvasRenderingContext2D): void {
  assertFontsReady();
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, WIDTH - 6, HEIGHT - 6);

  drawSeal(ctx, WIDTH / 2, 108, 58);

  ctx.fillStyle = palette.ink;
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px Oswald, sans-serif';
  ctx.fillText('LEONIDA STATE POLICE', WIDTH / 2, 205);

  const [, division] = JURISDICTION.split(' — ');
  ctx.font = '16px "Courier Prime", monospace';
  drawTracked(ctx, division ?? 'WANTED DIV.', WIDTH / 2, 232, 4);

  drawDoubleRule(ctx, 60, WIDTH - 60, 260);

  ctx.font = 'bold 84px Oswald, sans-serif';
  ctx.fillText('WANTED', WIDTH / 2, 355);

  drawCornerMarks(ctx, WINDOW.x, WINDOW.y, WINDOW.width, WINDOW.height);
}

/** Original badge: two rings and a five-point star. No real agency's insignia. */
function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  const spikes = 5;
  const outer = r - 16;
  const inner = outer * 0.45;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDoubleRule(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y + 6);
  ctx.lineTo(x2, y + 6);
  ctx.stroke();
  ctx.restore();
}

/** Print-shop crop marks at the four corners of a window -- not a solid frame. */
function drawCornerMarks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const len = 18;
  const gap = 6;
  const corners: readonly [number, number, 1 | -1, 1 | -1][] = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ];
  ctx.save();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + gap * dx, cy);
    ctx.lineTo(cx + (gap + len) * dx, cy);
    ctx.moveTo(cx, cy + gap * dy);
    ctx.lineTo(cx, cy + (gap + len) * dy);
    ctx.stroke();
  }
  ctx.restore();
}

/** Fits the portrait into the window without distorting its aspect ratio. */
function drawPortrait(ctx: CanvasRenderingContext2D, image: HTMLImageElement): void {
  const scale = Math.min(WINDOW.width / image.naturalWidth, WINDOW.height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  const x = WINDOW.x + (WINDOW.width - w) / 2;
  const y = WINDOW.y + (WINDOW.height - h) / 2;
  ctx.drawImage(image, x, y, w, h);
}

/**
 * createImageBitmap() cannot decode SVG sources in Chrome -- only raster
 * formats -- so portraits (all SVG) must go through an <img> element instead.
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Portrait image failed to decode'));
    };
    img.src = url;
  });
}

/**
 * Grades run off the main thread via gradeOffThread -- see src/canvas/grade/.
 * `raw` skips the getImageData/putImageData round trip entirely rather than
 * paying for it (plus a worker round trip) to run a no-op grade.
 */
async function applyLook(ctx: CanvasRenderingContext2D, look: LookId): Promise<void> {
  if (look === 'raw') return;
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const graded = await gradeOffThread(imageData.data, look, { width: WIDTH, height: HEIGHT });
  ctx.putImageData(new ImageData(graded, WIDTH, HEIGHT), 0, 0);
}

function drawFields(
  ctx: CanvasRenderingContext2D,
  suspect: SuspectId,
  bountyText: string,
  controlNumber: ControlNumber,
): void {
  assertFontsReady();
  const record = SUSPECTS[suspect];
  ctx.save();
  ctx.fillStyle = palette.ink;

  const rows: readonly [string, string][] = [
    ['RECORD NO.', suspect],
    ['NAME', record.name.toUpperCase()],
    ['AKA', record.alias === '—' ? '—' : `"${record.alias.toUpperCase()}"`],
    ['CHARGE', record.charge.toUpperCase()],
    ['LAST KNOWN POS.', record.lastSeen.toUpperCase()],
  ];

  const labelX = WIDTH / 2 - 20;
  const valueX = WIDTH / 2 + 20;
  const rowStart = 945;
  const rowHeight = 30;
  ctx.font = '15px "Courier Prime", monospace';
  rows.forEach(([label, value], i) => {
    const y = rowStart + i * rowHeight;
    ctx.textAlign = 'right';
    ctx.fillText(label, labelX, y);
    ctx.textAlign = 'left';
    ctx.fillText(value, valueX, y);
  });

  ctx.textAlign = 'center';
  ctx.font = 'bold 46px Oswald, sans-serif';
  ctx.fillText(bountyText || `REWARD $${record.bounty.toLocaleString()}`, WIDTH / 2, 1195);

  drawFooter(ctx, record.intakeDate, controlNumber);
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, intakeDate: string, controlNumber: ControlNumber): void {
  const margin = 70;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin, 1240);
  ctx.lineTo(WIDTH - margin, 1240);
  ctx.stroke();

  ctx.font = '13px "Courier Prime", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ISSUING OFFICER: DUTY SGT., WANTED DIV.', margin, 1265);
  ctx.textAlign = 'right';
  ctx.fillText(`DATE: ${intakeDate}`, WIDTH - margin, 1265);

  ctx.beginPath();
  ctx.moveTo(margin, 1310);
  ctx.lineTo(margin + 260, 1310);
  ctx.stroke();
  ctx.font = '11px "Courier Prime", monospace';
  drawTracked(ctx, 'AUTHORIZING SIGNATURE', margin + 130, 1326, 2);

  ctx.textAlign = 'right';
  ctx.font = '13px "Courier Prime", monospace';
  ctx.fillText(`CTRL ${controlNumber}`, WIDTH - margin, 1326);
}

/**
 * Letter-spaced text -- canvas has no tracking property, so each glyph is
 * placed by hand using its measured width plus a fixed pixel gap.
 */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, letterGapPx: number): void {
  const chars = text.split('');
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + letterGapPx * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - totalWidth / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + letterGapPx;
  });
  ctx.textAlign = prevAlign;
}
