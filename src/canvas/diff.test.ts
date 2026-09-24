// Run with: npm run test
import { computeDelta } from './diff';
import { assertEqual } from '../test/assert';

class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

function solid(w: number, h: number, [r, g, b, a]: readonly [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return new FakeImageData(data, w, h) as unknown as ImageData;
}

assertEqual(computeDelta(solid(4, 4, [10, 20, 30, 255]), solid(4, 4, [10, 20, 30, 255])), 0, 'identical images -> zero delta');

// Half the frame (2 of 4 rows) driven from white to black -- each changed
// pixel swings the full 0-255 range, so delta should land exactly at the
// obscured area's fraction of the frame.
{
  const w = 4;
  const h = 4;
  const reference = solid(w, h, [255, 255, 255, 255]);
  const candidate = solid(w, h, [255, 255, 255, 255]);
  for (let y = 0; y < h / 2; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      candidate.data[i] = 0;
      candidate.data[i + 1] = 0;
      candidate.data[i + 2] = 0;
    }
  }
  const delta = computeDelta(reference, candidate);
  assertEqual(Math.round(delta * 100) / 100, 0.5, 'half the frame blacked out -> proportional delta');
}

// Alpha changes alone (fully opaque plates never vary alpha in practice) must not move the score.
assertEqual(
  computeDelta(solid(2, 2, [50, 60, 70, 255]), solid(2, 2, [50, 60, 70, 0])),
  0,
  'alpha is ignored',
);

// The whole point of `region`: an edit confined to one corner reads as a
// small change to the frame and a total change to that corner. Averaging it
// across the plate -- what the score used to do -- is what made blacking out
// the margins worth more than blacking out a face.
{
  const w = 8;
  const h = 8;
  const reference = solid(w, h, [255, 255, 255, 255]);
  const candidate = solid(w, h, [255, 255, 255, 255]);
  // Top-left quadrant of the top-left quadrant: 2x2 of 64 pixels.
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const i = (y * w + x) * 4;
      candidate.data[i] = candidate.data[i + 1] = candidate.data[i + 2] = 0;
    }
  }
  assertEqual(computeDelta(reference, candidate), 4 / 64, 'over the whole frame the edit all but disappears');
  assertEqual(
    computeDelta(reference, candidate, { x: 0, y: 0, w: 0.25, h: 0.25 }),
    1,
    'over its own region the same edit reads as total',
  );
  assertEqual(
    computeDelta(reference, candidate, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }),
    0,
    'a region the edit never touched reads as untouched',
  );
}

// A region thinner than one pixel still describes a real feature, so it
// reads the pixel it lands on rather than dividing by an empty window.
{
  const reference = solid(4, 4, [0, 0, 0, 255]);
  const candidate = solid(4, 4, [255, 255, 255, 255]);
  const delta = computeDelta(reference, candidate, { x: 0.5, y: 0.5, w: 0.001, h: 0.001 });
  assertEqual(delta, 1, 'a sub-pixel region still measures one pixel, never NaN');
}

let threw = false;
try {
  computeDelta(solid(2, 2, [0, 0, 0, 255]), solid(3, 3, [0, 0, 0, 255]));
} catch {
  threw = true;
}
assertEqual(threw, true, 'mismatched sizes throw');

console.log('diff.test.ts: ok');
