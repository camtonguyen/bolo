// Run with: npm run test
import { gradeCapped, MAX_GRADE_EDGE } from './core';
import type { GradeCanvas } from './core';
import { assertEqual, assertTruthy } from '../../test/assert';

// core.ts only touches `ImageData` inside function bodies, so registering a
// minimal stand-in before calling gradeCapped is enough -- no jsdom needed,
// this test runner is plain Node.
class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}
(globalThis as unknown as { ImageData: unknown }).ImageData = FakeImageData;

/** Nearest-neighbor canvas stand-in -- just enough of the 2D context surface for gradeCapped's resize round trip. */
class FakeCanvas {
  pixels: Uint8ClampedArray;
  constructor(
    public width: number,
    public height: number,
  ) {
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }
  getContext() {
    return {
      putImageData: (imageData: { data: Uint8ClampedArray }) => {
        this.pixels.set(imageData.data);
      },
      getImageData: (_sx: number, _sy: number, sw: number, sh: number) => {
        return new FakeImageData(new Uint8ClampedArray(this.pixels), sw, sh) as unknown as ImageData;
      },
      drawImage: (image: FakeCanvas, _dx: number, _dy: number, dw: number, dh: number) => {
        for (let y = 0; y < dh; y++) {
          for (let x = 0; x < dw; x++) {
            const sx = Math.floor((x / dw) * image.width);
            const sy = Math.floor((y / dh) * image.height);
            const si = (sy * image.width + sx) * 4;
            const di = (y * this.width + x) * 4;
            this.pixels[di] = image.pixels[si];
            this.pixels[di + 1] = image.pixels[si + 1];
            this.pixels[di + 2] = image.pixels[si + 2];
            this.pixels[di + 3] = image.pixels[si + 3];
          }
        }
      },
    };
  }
}

const makeCanvas = (w: number, h: number) => new FakeCanvas(w, h) as unknown as GradeCanvas;

// Under the cap: grades directly at the same size, no canvas touched.
const flat = new Uint8ClampedArray(4 * 4 * 4).fill(128);
const underCap = gradeCapped(flat, 'archival', { width: 4, height: 4 }, makeCanvas);
assertEqual(underCap.length, flat.length, 'under-cap output matches input length');
assertTruthy(underCap[0] !== flat[0] || underCap[2] !== flat[2], 'under-cap actually ran the grade');

// Over the cap: resizes down, grades, resizes back up to the original size.
const bigWidth = MAX_GRADE_EDGE + 200;
const bigHeight = 400;
const big = new Uint8ClampedArray(bigWidth * bigHeight * 4).fill(200);
const overCap = gradeCapped(big, 'degraded', { width: bigWidth, height: bigHeight }, makeCanvas);
assertEqual(overCap.length, big.length, 'over-cap output is scaled back to the original size');

console.log('core.test.ts: ok');
