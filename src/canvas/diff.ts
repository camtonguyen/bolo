import type { Rect } from './overlays';

/**
 * Working resolution for forensic-diff bitmaps -- cheap enough to decode and
 * diff on every poll tick. 128, not 64: a marker region is measured on its
 * own here (see computeDelta's `region`), and the smallest markers in the
 * cast project to roughly 2px tall on a 64px bitmap -- too thin to read.
 */
// ponytail: 128 is the floor that keeps the smallest current marker above ~3px. Raise it if the cast gains finer features.
export const DIFF_SIZE = 128;

/**
 * Average per-channel absolute difference between two same-size RGB(A)
 * buffers, normalized to 0-1. Alpha is ignored -- plates are always fully
 * opaque, so it would only dilute the signal.
 *
 * With `region` (plate-normalized 0-1, the same space overlays and markers
 * use) only that window is compared, which is how an edit made with the
 * SDK's own tools gets attributed to the feature it actually covers instead
 * of being averaged away across the whole plate.
 *
 * Pure arithmetic, no DOM: both inputs must already be decoded and
 * downsampled to the same size (see EditorPanel's decode step) so this stays
 * cheap enough to run on every poll tick and testable without a canvas.
 */
export function computeDelta(reference: ImageData, candidate: ImageData, region?: Rect): number {
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error('computeDelta: images must be the same size');
  }
  const { width, height } = reference;
  const a = reference.data;
  const b = candidate.data;

  // Rounded outward, and never to an empty window: a region thinner than one
  // pixel still describes a real feature, so it reads that one pixel rather
  // than silently scoring zero.
  const x0 = region ? clamp(Math.floor(region.x * width), 0, width - 1) : 0;
  const y0 = region ? clamp(Math.floor(region.y * height), 0, height - 1) : 0;
  const x1 = region ? clamp(Math.ceil((region.x + region.w) * width), x0 + 1, width) : width;
  const y1 = region ? clamp(Math.ceil((region.y + region.h) * height), y0 + 1, height) : height;

  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    }
  }
  const channelCount = (x1 - x0) * (y1 - y0) * 3;
  return total / (channelCount * 255);
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
