import { formatMarkersEntry } from './formatMarkersEntry';
import { assertEqual } from '../test/assert';

const out = formatMarkersEntry('DR-4417', [
  { id: 'voss-hairline', label: 'hairline, bangs', weight: 30, region: { x: 0.181, y: 0.02, w: 0.64, h: 0.156 } },
]);

assertEqual(
  out,
  "  'DR-4417': [\n    { id: 'voss-hairline', label: 'hairline, bangs', weight: 30, region: { x: 0.18, y: 0.02, w: 0.64, h: 0.16 } },\n  ],",
  'formats one marker, rounded to 2dp',
);

console.log('formatMarkersEntry.test.ts: ok');
