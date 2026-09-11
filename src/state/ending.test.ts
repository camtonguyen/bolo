// Run with: npm run test
import { deriveEnding } from './ending';
import type { Verdict } from '../scoring/recognition';
import type { CompositeConfig } from '../canvas/pipeline';
import { assertEqual } from '../test/assert';

const config = (substitutedPortrait: CompositeConfig['substitutedPortrait'] = null): CompositeConfig => ({
  version: 1,
  look: 'raw',
  overlays: [],
  bountyText: '',
  substitutedPortrait,
});

const verdict = (outcome: Verdict['outcome']): Verdict => ({
  match: outcome === 'identified' ? 50 : 20,
  tamper: outcome === 'flagged' ? 70 : 10,
  outcome,
  heatDelta: 0,
});

assertEqual(deriveEnding(verdict('identified'), config(), 0), 'identified', 'identified always ends the run, no heat gate');
assertEqual(deriveEnding(verdict('identified'), config(), 100), 'identified', 'identified ends the run even at max heat');

assertEqual(deriveEnding(verdict('flagged'), config(), 99), null, 'flagged but heat not yet maxed: run continues');
assertEqual(deriveEnding(verdict('flagged'), config(), 100), 'burned', 'flagged with heat maxed: burned');

assertEqual(deriveEnding(verdict('clean'), config(), 49), 'clean', 'clean, no substitution, heat under 50: clean ending');
assertEqual(deriveEnding(verdict('clean'), config(), 50), null, 'clean but heat at 50: run continues, not clean enough yet');

assertEqual(deriveEnding(verdict('clean'), config('DR-4417'), 0), 'complicit', 'clean with a substituted portrait: complicit, regardless of heat');
assertEqual(deriveEnding(verdict('clean'), config('DR-4417'), 99), 'complicit', 'complicit overrides the heat gate entirely');

console.log('ending.test.ts: ok');
