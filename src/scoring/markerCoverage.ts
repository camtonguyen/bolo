import { SUSPECTS, type SuspectId } from '../data/suspects';
import { MARKERS, type Marker } from '../data/markers';
import { STAMPS } from '../assets/stamps';
import { PLATE_WIDTH, PLATE_HEIGHT, PORTRAIT_WINDOW, type CompositeConfig, type OverlayPlacement } from '../canvas/pipeline';

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/**
 * Marker regions are normalized against each portrait's own raw pixel
 * bounds (how the marker authoring tool draws them, over the <img> alone).
 * Overlays are normalized against the full plate canvas. This projects a
 * marker into that same canvas-normalized space, reusing pipeline.ts's own
 * drawPortrait scale-to-fit math so the two never drift apart.
 */
/** Exported so the composer's marker overlay (Part 5.2) can position boxes in the same space, not just score them. */
export function markerCanvasRect(suspect: SuspectId, region: Rect): Rect {
  const { w: imgW, h: imgH } = SUSPECTS[suspect].portraitSize;
  const scale = Math.min(PORTRAIT_WINDOW.width / imgW, PORTRAIT_WINDOW.height / imgH);
  const renderedW = imgW * scale;
  const renderedH = imgH * scale;
  const offsetX = PORTRAIT_WINDOW.x + (PORTRAIT_WINDOW.width - renderedW) / 2;
  const offsetY = PORTRAIT_WINDOW.y + (PORTRAIT_WINDOW.height - renderedH) / 2;

  return {
    x: (offsetX + region.x * renderedW) / PLATE_WIDTH,
    y: (offsetY + region.y * renderedH) / PLATE_HEIGHT,
    w: (region.w * renderedW) / PLATE_WIDTH,
    h: (region.h * renderedH) / PLATE_HEIGHT,
  };
}

/**
 * Same sizing math as canvas/overlays.ts's drawOverlay, in normalized units
 * instead of pixels. Exported so recognition.ts can price tamper by how much
 * of the plate an overlay actually covers, instead of a flat per-instance
 * cost that would make picking the biggest stamp strictly dominant.
 */
export function overlayCanvasRect(placement: OverlayPlacement): Rect {
  const stamp = STAMPS[placement.id];
  const w = stamp.widthFraction;
  const h = (w * (PLATE_WIDTH / PLATE_HEIGHT)) / stamp.aspectRatio;
  return { x: placement.x - w / 2, y: placement.y - h / 2, w, h };
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
 */
const GRADE_SMALL_REGION_AREA = 0.006;

/**
 * Whether the composited edit covers this marker's region enough that it no
 * longer reads in the bulletin. No crop technique yet -- the SDK exposes no
 * way to read a crop rect back out of the editor, only the final flattened
 * image, so there is nothing to project here.
 */
export function isObscured(suspect: SuspectId, marker: Marker, config: CompositeConfig, gradeIntensity: number): boolean {
  const canvasRect = markerCanvasRect(suspect, marker.region);
  const markerArea = canvasRect.w * canvasRect.h;
  if (markerArea <= 0) return false;

  const overlayHit = config.overlays.some(
    (placement) => intersectionArea(canvasRect, overlayCanvasRect(placement)) / markerArea > OVERLAY_OBSCURE_FRACTION,
  );
  if (overlayHit) return true;

  return gradeIntensity >= 1 && markerArea < GRADE_SMALL_REGION_AREA;
}

/** Sum of weights for markers NOT sufficiently obscured -- the coverage-based replacement for the old blunt match weights. */
export function coverageMatch(suspect: SuspectId, config: CompositeConfig, gradeIntensity: number): number {
  return MARKERS[suspect].reduce(
    (match, marker) => (isObscured(suspect, marker, config, gradeIntensity) ? match : match + marker.weight),
    0,
  );
}
