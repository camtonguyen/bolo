// Run with: npm run test
import { deriveTechniques, incrementSuspicion, mostSuspicious, ZERO_SUSPICION } from './technique';
import type { CompositeConfig } from '../canvas/pipeline';
import { assertEqual } from '../test/assert';

const base = (overrides: Partial<CompositeConfig> = {}): CompositeConfig => ({
  version: 1,
  look: 'raw',
  overlays: [],
  bountyText: '',
  substitutedPortrait: null,
  ...overrides,
});

assertEqual(deriveTechniques(base()), [], 'raw plate, no overlays, no substitution: no techniques');
assertEqual(deriveTechniques(base({ look: 'archival' })), ['grade'], 'any non-raw look counts as grade');
assertEqual(deriveTechniques(base({ overlays: [{ id: 'seal', x: 0.5, y: 0.5 }] })), ['overlay'], 'any overlay counts as overlay');
assertEqual(deriveTechniques(base({ substitutedPortrait: 'DR-4417' })), ['substitution'], 'a substituted portrait counts as substitution');
assertEqual(
  deriveTechniques(base({ look: 'degraded', overlays: [{ id: 'seal', x: 0.5, y: 0.5 }], substitutedPortrait: 'DR-4417' })),
  ['grade', 'overlay', 'substitution'],
  'all three stack',
);

assertEqual(incrementSuspicion(ZERO_SUSPICION, []), ZERO_SUSPICION, 'no techniques used leaves suspicion untouched');
assertEqual(incrementSuspicion(ZERO_SUSPICION, ['grade']), { grade: 1, overlay: 0, substitution: 0 }, 'bumps only the used technique');
assertEqual(
  incrementSuspicion({ grade: 2, overlay: 0, substitution: 0 }, ['grade', 'overlay']),
  { grade: 3, overlay: 1, substitution: 0 },
  'bumps each used technique from its prior count',
);

assertEqual(mostSuspicious([], ZERO_SUSPICION), null, 'no techniques used: nothing to call out');
assertEqual(mostSuspicious(['grade'], ZERO_SUSPICION), 'grade', 'a single technique is trivially the most suspicious');
assertEqual(
  mostSuspicious(['grade', 'overlay'], { grade: 1, overlay: 4, substitution: 0 }),
  'overlay',
  'picks the technique with the higher prior-use count',
);
assertEqual(
  mostSuspicious(['grade', 'overlay'], ZERO_SUSPICION),
  'grade',
  'a tie keeps the first candidate',
);

console.log('technique.test.ts: ok');
