import { hash } from './noise';
import type { Grade } from './types';

export const intensity = 1;

const POSTER_LEVELS = 3;
const CRUSH_FACTOR = 1.8;
const EDGE_THRESHOLD = 40;
const EDGE_JITTER = 60;
const TEAR_ROW_FRACTIONS = [0.37, 0.74] as const;

const crush = (v: number): number => (v - 128) * CRUSH_FACTOR + 128;

const posterize = (v: number): number => (Math.round((v / 255) * (POSTER_LEVELS - 1)) / (POSTER_LEVELS - 1)) * 255;

const luminance = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

export const grade: Grade = (data, { width, height }) => {
  const tearRows = new Set(TEAR_ROW_FRACTIONS.map((f) => Math.floor(height * f)));

  for (let y = 0; y < height; y++) {
    if (tearRows.has(y)) {
      // A paper-feed glitch: the scan skips a line rather than reading it.
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 245;
      }
      continue;
    }

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];

      // Measured against the source pixel to the right -- still unmodified
      // this pass -- so the edge reflects the portrait, not our own crush.
      const rightI = x + 1 < width ? i + 4 : i;
      const edgeStrength = Math.abs(
        luminance(r0, g0, b0) - luminance(data[rightI], data[rightI + 1], data[rightI + 2]),
      );

      let r = posterize(crush(r0));
      let g = posterize(crush(g0));
      let b = posterize(crush(b0));

      if (edgeStrength > EDGE_THRESHOLD) {
        const jitter = (hash(x, y) - 0.5) * EDGE_JITTER;
        r += jitter;
        g += jitter;
        b += jitter;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
};
