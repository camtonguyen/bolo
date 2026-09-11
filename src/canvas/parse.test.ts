// Run with: npm run test
import { parseCompositeConfig } from './parse';
import { assertEqual } from '../test/assert';

const valid = {
  version: 1,
  look: 'archival',
  overlays: [
    { id: 'seal', x: 0.62, y: 0.6 },
    { id: 'glare', x: 0.5, y: 0.47 },
  ],
  bountyText: 'REWARD $45,000',
  substitutedPortrait: null,
};

assertEqual(parseCompositeConfig(valid), valid, 'valid config round-trips');
assertEqual(parseCompositeConfig({ ...valid, version: 2 }), null, 'rejects unknown version');
assertEqual(parseCompositeConfig({ ...valid, look: 'hd' }), null, 'rejects unknown look');
assertEqual(parseCompositeConfig({ ...valid, overlays: [{ id: 'sticker', x: 0.5, y: 0.5 }] }), null, 'rejects unknown overlay id');
assertEqual(parseCompositeConfig({ ...valid, overlays: [{ id: 'seal', x: 1.5, y: 0.5 }] }), null, 'rejects out-of-range overlay x');
assertEqual(parseCompositeConfig({ ...valid, overlays: [{ id: 'seal', x: 0.5 }] }), null, 'rejects overlay missing y');
assertEqual(parseCompositeConfig({ ...valid, overlays: 'seal' }), null, 'rejects non-array overlays');
assertEqual(parseCompositeConfig({ ...valid, bountyText: 'x'.repeat(60) }), null, 'rejects bountyText at the limit');
assertEqual(
  parseCompositeConfig({ ...valid, bountyText: 'x'.repeat(59) }),
  { ...valid, bountyText: 'x'.repeat(59) },
  'accepts bountyText just under the limit',
);
assertEqual(
  parseCompositeConfig({ ...valid, substitutedPortrait: 'DR-4417' }),
  { ...valid, substitutedPortrait: 'DR-4417' },
  'accepts a valid substituted suspect id',
);
assertEqual(parseCompositeConfig({ ...valid, substitutedPortrait: 'NOT-A-CASE' }), null, 'rejects an unknown substituted suspect id');
assertEqual(parseCompositeConfig({ ...valid, substitutedPortrait: undefined }), null, 'rejects a missing substitutedPortrait field');
assertEqual(parseCompositeConfig(null), null, 'rejects null');
assertEqual(parseCompositeConfig('nope'), null, 'rejects non-object');
assertEqual(parseCompositeConfig({}), null, 'rejects empty object');

console.log('parse.test.ts: ok');
