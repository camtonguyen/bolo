// Run with: npm run test
import { formatSyncStamp, getBootLines } from './BootSequence';
import { assertEqual, assertTruthy } from '../test/assert';

assertEqual(
  formatSyncStamp(new Date(Date.UTC(2026, 8, 6, 3, 4, 5))),
  '2026-09-06 03:04:05Z',
  'formats and zero-pads in UTC',
);

const lines = getBootLines(new Date(Date.UTC(2026, 8, 6, 3, 4, 5)));

assertTruthy(
  lines.some((l) => l.includes('Last sync') && l.includes('2026-09-06 03:04:05Z')),
  'boot lines include a last-sync stamp computed from the given date',
);
assertTruthy(
  lines.some((l) => l.includes('Record index')),
  'boot lines still imply record-count scale',
);
assertTruthy(
  lines.some((l) => l.includes('Dispatch uplink')),
  'boot lines still report uplink status',
);
assertTruthy(lines.includes('AUTHORISED PERSONNEL ONLY'), 'ends on the authorisation line');

console.log('BootSequence.test.ts: ok');
