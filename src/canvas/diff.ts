/** Working resolution for forensic-diff bitmaps -- cheap enough to decode and diff on every poll tick. */
export const DIFF_SIZE = 64;

/**
 * Average per-channel absolute difference between two same-size RGB(A)
 * buffers, normalized to 0-1. Alpha is ignored -- plates are always fully
 * opaque, so it would only dilute the signal.
 *
 * Pure arithmetic, no DOM: both inputs must already be decoded and
 * downsampled to the same size (see EditorPanel's decode step) so this stays
 * cheap enough to run on every poll tick and testable without a canvas.
 */
export function computeDelta(reference: ImageData, candidate: ImageData): number {
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error('computeDelta: images must be the same size');
  }
  const a = reference.data;
  const b = candidate.data;
  let total = 0;
  for (let i = 0; i + 2 < a.length; i += 4) {
    total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  }
  const channelCount = (a.length / 4) * 3;
  return total / (channelCount * 255);
}
