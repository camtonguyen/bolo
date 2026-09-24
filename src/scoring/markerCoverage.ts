import { SUSPECTS, type SuspectId } from '../data/suspects';
import { MARKERS, type Marker, type MarkerId } from '../data/markers';
import { overlayRect, type Rect, type OverlayPlacement } from '../canvas/overlays';
import { PLATE_WIDTH, PLATE_HEIGHT, fitPortraitRect, type CompositeConfig } from '../canvas/pipeline';
import { LOOKS } from '../canvas/looks';

/**
 * Marker regions are normalized against each portrait's own raw pixel
 * bounds (how the marker authoring tool draws them, over the <img> alone).
 * Overlays are normalized against the full plate canvas. This projects a
 * marker into that same canvas-normalized space, calling pipeline.ts's own
 * fitPortraitRect() so the two never drift apart.
 */
function markerCanvasRect(suspect: SuspectId, region: Rect): Rect {
  const rendered = fitPortraitRect(SUSPECTS[suspect].portraitSize);

  return {
    x: (rendered.x + region.x * rendered.w) / PLATE_WIDTH,
    y: (rendered.y + region.y * rendered.h) / PLATE_HEIGHT,
    w: (region.w * rendered.w) / PLATE_WIDTH,
    h: (region.h * rendered.h) / PLATE_HEIGHT,
  };
}

/** Same sizing math as canvas/overlays.ts's drawOverlay, via its shared overlayRect(). */
function overlayCanvasRect(placement: OverlayPlacement): Rect {
  return overlayRect(placement, PLATE_WIDTH / PLATE_HEIGHT);
}

function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return w * h;
}

/** A bar over the face is evidence someone did it, so this threshold is deliberately low. */
const OVERLAY_OBSCURE_FRACTION = 0.6;
/**
 * Only the degraded look pushes hard enough to obscure detail, and only a
 * small feature at that. Not the doc's literal 0.03 -- that's a portrait-
 * space fraction, but marker areas here are canvas-normalized (the portrait
 * sits inside a small letterboxed window on a much bigger plate), so the
 * same cutoff there means "virtually every marker" here. Recalibrated
 * against this cast's actual canvas-space areas (0.0006-0.03): 0.006 catches
 * genuinely small features (a mole, one ear, a brow) without also catching
 * whole-face regions like a jawline or hairline.
 *
 * This is the cutoff at full intensity; a look scales it by its own (see
 * isObscured). A harder grade loses progressively larger features, which is
 * what makes a middle treatment a real choice rather than a dearer archival:
 * at 1 it loses a brow, at 0.7 a mustache, at 0.4 only a mole.
 */
const GRADE_SMALL_REGION_AREA = 0.006;

/**
 * How much more this marker's own region must have changed than the plate as
 * a whole before an in-editor edit counts as hiding the feature.
 *
 * Measured as an excess over the frame, not as a raw delta, because a global
 * change isn't concealment: running one of the SDK's filters over the whole
 * plate moves every region by roughly the same amount, so it reads as zero
 * excess here and pays tamper instead (see recognition.ts). Blacking out the
 * eyes with the draw tool moves that one region and nothing else.
 */
// ponytail: one flat threshold for every feature. If a marker ever needs its own sensitivity, it belongs on the marker, not here.
const EDITOR_LOCAL_EXCESS = 0.2;

/**
 * Whether the composited edit covers this marker's region enough that it no
 * longer reads in the bulletin. No crop technique yet -- the SDK exposes no
 * way to read a crop rect back out of the editor, only the final flattened
 * image, so there is nothing to project here. A crop still registers, just
 * bluntly: it reframes every region at once, so every marker reads as
 * heavily changed rather than as a rect we could actually resolve.
 */
function isObscured(
  canvasRect: Rect,
  config: CompositeConfig,
  gradeIntensity: number,
  localExcess: number,
): boolean {
  const markerArea = canvasRect.w * canvasRect.h;
  if (markerArea <= 0) return false;

  const overlayHit = config.overlays.some(
    (placement) => intersectionArea(canvasRect, overlayCanvasRect(placement)) / markerArea > OVERLAY_OBSCURE_FRACTION,
  );
  if (overlayHit) return true;
  if (localExcess > EDITOR_LOCAL_EXCESS) return true;

  // Scaled, not gated: raw's intensity of 0 puts the cutoff at 0, so it
  // still obscures nothing, and every look above it loses detail in
  // proportion to how hard it pushes.
  return markerArea < GRADE_SMALL_REGION_AREA * gradeIntensity;
}

export interface MarkerReading {
  readonly marker: Marker;
  /** Canvas-normalized, the same space overlays use -- where the composer's marker overlay draws it. */
  readonly rect: Rect;
  readonly obscured: boolean;
}

export interface Coverage {
  readonly markers: readonly MarkerReading[];
  /** Sum of weights for markers NOT sufficiently obscured -- the coverage-based replacement for the old blunt match weights. */
  readonly match: number;
  /**
   * How many markers the editor's own tools hid, and nothing else would
   * have. recognition.ts prices these separately: a precise redaction over a
   * feature is exactly what a reviewing officer looks for, and the
   * frame-average reading can't see it.
   */
  readonly editorObscured: number;
}

/**
 * What the forensic poll measured of the editor's own tools -- see
 * canvas/diff.ts and composer/editorWatch.ts. `frame` is the whole-plate
 * delta; `regions` is the same measurement taken per marker.
 */
export interface EditorReading {
  readonly frame: number;
  readonly regions: Readonly<Partial<Record<MarkerId, number>>>;
}

export const NO_EDITOR_EDITS: EditorReading = { frame: 0, regions: {} };

/**
 * Where each marker sits on the plate, in the canvas-normalized space
 * overlays use. Separate from readCoverage because the poll needs the rects
 * *before* there's any reading to interpret -- but it's the same
 * markerCanvasRect() underneath, so the two can't drift.
 */
export function markerRects(suspect: SuspectId): readonly { id: MarkerId; rect: Rect }[] {
  return MARKERS[suspect].map((marker) => ({ id: marker.id, rect: markerCanvasRect(suspect, marker.region) }));
}

/**
 * The one readout of what a config hides: the score (evaluate) and the
 * composer's marker overlay both read it, so what the player sees drawn
 * as obscured is exactly what was scored as obscured.
 *
 * `editor` is the one input that can't come from the config -- the SDK's own
 * crop/text/sticker/draw tools never touch CompositeConfig, so what they did
 * is only knowable by looking at the rendered image (canvas/diff.ts).
 */
export function readCoverage(
  suspect: SuspectId,
  config: CompositeConfig,
  editor: EditorReading = NO_EDITOR_EDITS,
): Coverage {
  const gradeIntensity = LOOKS[config.look].intensity;
  // A substituted portrait carries none of this suspect's markers at all --
  // there's nothing left to recognise, so every one reads as obscured.
  const substituted = config.substitutedPortrait !== null;
  let editorObscured = 0;

  const markers = MARKERS[suspect].map((marker) => {
    const rect = markerCanvasRect(suspect, marker.region);
    const localExcess = (editor.regions[marker.id] ?? 0) - editor.frame;
    const obscured = substituted || isObscured(rect, config, gradeIntensity, localExcess);
    // Only counted when the editor is what hid it: a marker already under a
    // stamp isn't charged twice for also being drawn over.
    if (obscured && !substituted && !isObscured(rect, config, gradeIntensity, 0)) editorObscured += 1;
    return { marker, rect, obscured };
  });

  const match = markers.reduce((sum, m) => (m.obscured ? sum : sum + m.marker.weight), 0);
  return { markers, match, editorObscured };
}

/**
 * Total plate area the config's overlays cover, in canvas-normalized units.
 * recognition.ts prices tamper by this instead of a flat per-instance cost,
 * which would make picking the biggest stamp strictly dominant.
 */
export function overlayFootprint(config: CompositeConfig): number {
  return config.overlays.reduce((sum, placement) => {
    const rect = overlayCanvasRect(placement);
    return sum + rect.w * rect.h;
  }, 0);
}
