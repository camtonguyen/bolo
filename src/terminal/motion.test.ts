// Run with: npm run test
import { CRT_MOTION, nextFlickerDelayMs } from './motion';
import { assertTruthy } from '../test/assert';

const { avgIntervalMs, jitterMs } = CRT_MOTION.flicker;

for (let i = 0; i < 1000; i++) {
  const delay = nextFlickerDelayMs();
  assertTruthy(
    delay >= avgIntervalMs - jitterMs && delay <= avgIntervalMs + jitterMs,
    `delay ${delay} stays within the jitter bounds`,
  );
}

assertTruthy(
  nextFlickerDelayMs(() => 0.5) === avgIntervalMs,
  'a midpoint random draw yields exactly the average interval',
);

assertTruthy(
  CRT_MOTION.bloom.nearOpacity > CRT_MOTION.bloom.farOpacity,
  'near bloom layer is brighter than the far layer, so small text does not smear',
);

console.log('motion.test.ts: ok');
