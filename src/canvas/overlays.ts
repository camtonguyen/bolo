import { STAMPS, type OverlayId } from '../assets/stamps';

export interface OverlayPlacement {
  readonly id: OverlayId;
  /** Normalized 0-1 against the plate's full width/height, so placement survives a resolution change. */
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const cache = new Map<OverlayId, HTMLImageElement>();

/**
 * Fetch -> blob -> object URL -> Image. An SVG string handed straight to
 * drawImage fails silently in Safari, so overlays go through a real decoded
 * Image element, same as portraits in pipeline.ts. Cached per id: these are
 * static assets, decoding one again on every composite is wasted work.
 */
async function loadOverlayImage(id: OverlayId): Promise<HTMLImageElement> {
  const cached = cache.get(id);
  if (cached) return cached;

  const res = await fetch(STAMPS[id].url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Overlay "${id}" failed to decode`));
    img.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);

  cache.set(id, image);
  return image;
}

/**
 * An overlay's placement rect in the plate's own normalized 0-1 space
 * (not pixels) -- the one sizing formula for a stamp, shared by drawOverlay()
 * and scoring/markerCoverage.ts's overlayCanvasRect() instead of each
 * carrying their own copy. `plateAspect` is the plate's width/height.
 */
export function overlayRect(placement: OverlayPlacement, plateAspect: number): Rect {
  const stamp = STAMPS[placement.id];
  const w = stamp.widthFraction;
  const h = (w * plateAspect) / stamp.aspectRatio;
  return { x: placement.x - w / 2, y: placement.y - h / 2, w, h };
}

/** Draws one overlay, sized from its registry aspect ratio and centered at its normalized placement. */
export async function drawOverlay(
  ctx: CanvasRenderingContext2D,
  placement: OverlayPlacement,
  canvasWidth: number,
  canvasHeight: number,
): Promise<void> {
  const image = await loadOverlayImage(placement.id);
  const rect = overlayRect(placement, canvasWidth / canvasHeight);
  ctx.drawImage(image, rect.x * canvasWidth, rect.y * canvasHeight, rect.w * canvasWidth, rect.h * canvasHeight);
}
