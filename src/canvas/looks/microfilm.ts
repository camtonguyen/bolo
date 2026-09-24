import { hash } from './noise';
import type { Grade } from './types';

/**
 * Between archival (0.4) and degraded (1). Microfilm is what the records
 * office has when the original intake scan is gone: legible, but a
 * generation removed from the document it came from.
 */
export const intensity = 0.7;

const TINT = { r: -10, g: -4, b: 14 } as const;
const GRAIN = 22;
/** Horizontal banding from the film transport, a few pixels apart -- deliberately just at the edge of visible. */
const BAND_PERIOD_PX = 3;
const BAND_STRENGTH = 4;

const luminance = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Smoothstep on 0-1, which fixes both ends and the midpoint. Applied twice
 * for a steeper shoulder: microfilm blows out its highlights and blocks up
 * its shadows, and mid-grey comes through untouched either way.
 */
function contrast(v: number): number {
  const t = v / 255;
  const once = t * t * (3 - 2 * t);
  return 255 * once * once * (3 - 2 * once);
}

export const grade: Grade = (data, { width, height }) => {
  for (let y = 0; y < height; y++) {
    // Per row, not per pixel -- the band is a transport artifact, not noise.
    const band = Math.sin(y / BAND_PERIOD_PX) * BAND_STRENGTH;

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // Desaturated first: microfilm is a monochrome stock, and the cast is
      // tinted back in below rather than carried through from the portrait.
      const v = contrast(luminance(data[i], data[i + 1], data[i + 2]));
      const grain = (hash(x, y) - 0.5) * GRAIN;

      data[i] = v + TINT.r + grain + band;
      data[i + 1] = v + TINT.g + grain + band;
      data[i + 2] = v + TINT.b + grain + band;
    }
  }
};
