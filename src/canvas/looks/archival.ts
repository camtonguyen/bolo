import { smoothNoise } from './noise';
import type { Grade } from './types';

export const intensity = 0.4;

const DUST_CELL_PX = 70;
const DUST_THRESHOLD = 0.62;
const DUST_STRENGTH = 26;

/** Pulls a channel toward mid-grey, tapering off near black and white so contrast loss reads as aged paper, not a flat wash. */
function liftMidtones(v: number): number {
  const distFromMid = Math.abs(v - 128) / 128;
  const pull = 0.22 * (1 - distFromMid);
  return v + (128 - v) * pull;
}

export const grade: Grade = (data, { width, height }) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      let r = liftMidtones(data[i] + 14);
      let g = liftMidtones(data[i + 1] + 5);
      let b = liftMidtones(data[i + 2] - 12);

      const dust = smoothNoise(x, y, DUST_CELL_PX);
      if (dust > DUST_THRESHOLD) {
        const darken = ((dust - DUST_THRESHOLD) / (1 - DUST_THRESHOLD)) * DUST_STRENGTH;
        r -= darken;
        g -= darken;
        b -= darken;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
};
