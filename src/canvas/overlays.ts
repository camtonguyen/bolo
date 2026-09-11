import { STAMPS, type OverlayId } from '../assets/stamps';

export interface OverlayPlacement {
  readonly id: OverlayId;
  /** Normalized 0-1 against the plate's full width/height, so placement survives a resolution change. */
  readonly x: number;
  readonly y: number;
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

/** Draws one overlay, sized from its registry aspect ratio and centered at its normalized placement. */
export async function drawOverlay(
  ctx: CanvasRenderingContext2D,
  placement: OverlayPlacement,
  canvasWidth: number,
  canvasHeight: number,
): Promise<void> {
  const stamp = STAMPS[placement.id];
  const image = await loadOverlayImage(placement.id);
  const w = canvasWidth * stamp.widthFraction;
  const h = w / stamp.aspectRatio;
  const x = placement.x * canvasWidth - w / 2;
  const y = placement.y * canvasHeight - h / 2;
  ctx.drawImage(image, x, y, w, h);
}
