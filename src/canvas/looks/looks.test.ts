// Run with: npm run test
import { LOOKS } from './index';
import { assertEqual, assertTruthy } from '../../test/assert';

function makeBuffer(width: number, height: number, fill: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(fill);
  return data;
}

// raw is a true no-op, not a loop that does nothing.
const rawBuffer = makeBuffer(4, 4, 128);
const rawBefore = [...rawBuffer];
LOOKS.raw.grade(rawBuffer, { width: 4, height: 4 });
assertEqual([...rawBuffer], rawBefore, 'raw grade leaves the buffer untouched');
assertEqual(LOOKS.raw.intensity, 0, 'raw carries zero intensity');

// archival and degraded are pure functions of (data, size): same input, same output.
for (const id of ['archival', 'degraded'] as const) {
  const a = makeBuffer(32, 32, 128);
  const b = makeBuffer(32, 32, 128);
  LOOKS[id].grade(a, { width: 32, height: 32 });
  LOOKS[id].grade(b, { width: 32, height: 32 });
  assertEqual([...a], [...b], `${id} grade is deterministic for identical input`);
}

// archival should visibly warm and soften a flat mid-grey field.
const archivalBuffer = makeBuffer(16, 16, 128);
LOOKS.archival.grade(archivalBuffer, { width: 16, height: 16 });
assertTruthy(archivalBuffer[0] > 128, 'archival warms the red channel above neutral grey');
assertTruthy(archivalBuffer[2] < 128, 'archival cools the blue channel below neutral grey');
assertEqual(LOOKS.archival.intensity, 0.4, 'archival intensity matches the tuned scoring weight');

// degraded posterizes to exactly 3 levels: 0, 127.5, 255.
const degradedBuffer = makeBuffer(8, 8, 128);
LOOKS.degraded.grade(degradedBuffer, { width: 8, height: 8 });
const posterLevels = new Set<number>();
for (let i = 0; i < degradedBuffer.length; i += 4) posterLevels.add(degradedBuffer[i]);
assertTruthy(posterLevels.size <= 3, `degraded posterizes to at most 3 levels, got ${posterLevels.size}`);
assertEqual(LOOKS.degraded.intensity, 1, 'degraded intensity matches the tuned scoring weight');

// degraded tears exactly the declared rows to a near-white streak.
const tearBuffer = makeBuffer(4, 100, 10);
LOOKS.degraded.grade(tearBuffer, { width: 4, height: 100 });
for (const y of [37, 74]) {
  const i = (y * 4 + 1) * 4;
  assertEqual(tearBuffer[i], 245, `row ${y} is torn to a near-white streak`);
}

console.log('looks.test.ts: ok');
