import { SUSPECTS, type SuspectId } from '../data/suspects';
import { MARKERS, type Marker } from '../data/markers';
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
 */
const GRADE_SMALL_REGION_AREA = 0.006;

/**
 * Whether the composited edit covers this marker's region enough that it no
 * longer reads in the bulletin. No crop technique yet -- the SDK exposes no
 * way to read a crop rect back out of the editor, only the final flattened
 * image, so there is nothing to project here.
 */
function isObscured(canvasRect: Rect, config: CompositeConfig, gradeIntensity: number): boolean {
  const markerArea = canvasRect.w * canvasRect.h;
  if (markerArea <= 0) return false;

  const overlayHit = config.overlays.some(
    (placement) => intersectionArea(canvasRect, overlayCanvasRect(placement)) / markerArea > OVERLAY_OBSCURE_FRACTION,
  );
  if (overlayHit) return true;

  return gradeIntensity >= 1 && markerArea < GRADE_SMALL_REGION_AREA;
}

export interface MarkerReading {
  readonly marker: Marker;
  /** Canvas-normalized, the same space overlays use -- where the composer's marker overlay draws it. */
  readonly rect: Rect;
  readonly obscured: boolean;
}

export interface Coverage {
  readonly markers: readonly MarkerReading[];
  /** Sum of weights for markers NOT sufficiently obscured -- the coverage-based replacement for the old blunt match weights. Doesn't know about portrait substitution; evaluate() zeroes it. */
  readonly match: number;
}

/**
 * The one readout of what a config hides: the score (evaluate) and the
 * composer's marker overlay both read it, so what the player sees drawn
 * as obscured is exactly what was scored as obscured.
 */
export function readCoverage(suspect: SuspectId, config: CompositeConfig): Coverage {
  const gradeIntensity = LOOKS[config.look].intensity;
  const markers = MARKERS[suspect].map((marker) => {
    const rect = markerCanvasRect(suspect, marker.region);
    return { marker, rect, obscured: isObscured(rect, config, gradeIntensity) };
  });
  const match = markers.reduce((sum, m) => (m.obscured ? sum : sum + m.marker.weight), 0);
  return { markers, match };
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
