// Run with: npm run test
import { resolveIssue, type IssueInput } from './issue';
import type { Bulletin } from './terminal';
import type { Verdict } from '../scoring/recognition';
import type { CompositeConfig } from '../canvas/pipeline';
import { ZERO_SUSPICION } from '../scoring/technique';
import { OPERATOR_RECORD_ID, CASES_BEFORE_REVEAL } from '../data/suspects';
import { assertEqual, assertTruthy } from '../test/assert';

const config = (overrides: Partial<CompositeConfig> = {}): CompositeConfig => ({
  version: 1,
  look: 'raw',
  overlays: [],
  bountyText: '',
  substitutedPortrait: null,
  ...overrides,
});

const bulletin = (overrides: Partial<Bulletin> = {}): Bulletin => ({
  suspect: OPERATOR_RECORD_ID,
  controlNumber: 'LSP-TEST-001' as Bulletin['controlNumber'],
  posterDataUrl: 'data:image/png;base64,',
  config: config(),
  issuedAt: 0,
  ...overrides,
});

const verdict = (overrides: Partial<Verdict> = {}): Verdict => ({
  match: 100,
  tamper: 0,
  outcome: 'identified',
  heatDelta: 15,
  ...overrides,
});

const baseState: IssueInput = {
  bulletins: [],
  casesClosed: 0,
  heat: 0,
  suspicion: ZERO_SUSPICION,
  operatorFlagged: false,
  ending: null,
  revealed: false,
};

// A non-operator suspect never touches heat, flag status, or ending -- only
// suspicion and the bulletin log move.
{
  const result = resolveIssue(baseState, bulletin({ suspect: 'DR-4417' }), verdict({ outcome: 'flagged', heatDelta: 25 }));
  assertEqual(result.heat, 0, 'non-operator case leaves heat untouched');
  assertEqual(result.ending, null, 'non-operator case never sets an ending');
  assertEqual(result.operatorFlagged, false, 'non-operator flag does not set operatorFlagged');
  assertEqual(result.screen, { kind: 'verdict', suspect: 'DR-4417', verdict: verdict({ outcome: 'flagged', heatDelta: 25 }) }, 'non-operator case always routes to verdict');
}

// A clean operator bulletin below the heat-decay floor closes the run clean.
{
  const result = resolveIssue(baseState, bulletin(), verdict({ outcome: 'clean', heatDelta: -20 }));
  assertEqual(result.heat, 0, 'heat clamps at zero, never negative');
  assertEqual(result.ending, 'clean', 'clean outcome under the heat floor ends the run clean');
  assertEqual(result.screen, { kind: 'ending', ending: 'clean' }, 'a clean ending routes straight to the ending screen');
}

// A flagged operator bulletin sets operatorFlagged and heat, but only burns at 100 heat.
{
  const result = resolveIssue(baseState, bulletin(), verdict({ outcome: 'flagged', heatDelta: 25 }));
  assertEqual(result.heat, 25, 'flagged heatDelta applied to a starting heat of 0');
  assertEqual(result.operatorFlagged, true, 'a flagged operator bulletin sets operatorFlagged permanently');
  assertEqual(result.ending, null, 'flagged below 100 heat does not end the run');
  assertEqual(result.screen, { kind: 'verdict', suspect: OPERATOR_RECORD_ID, verdict: verdict({ outcome: 'flagged', heatDelta: 25 }) }, 'still routes to the normal verdict screen');
}

{
  const result = resolveIssue({ ...baseState, heat: 90 }, bulletin(), verdict({ outcome: 'flagged', heatDelta: 25 }));
  assertEqual(result.heat, 100, 'heat clamps at 100');
  assertEqual(result.ending, 'burned', 'flagged at max heat burns the run');
  assertEqual(result.screen, { kind: 'ending', ending: 'burned' }, 'burned routes to the ending screen');
}

// Sticky: once an ending is set, a later bulletin can't clear or change it, even with a clean outcome.
{
  const result = resolveIssue({ ...baseState, ending: 'burned' }, bulletin(), verdict({ outcome: 'clean', heatDelta: -20 }));
  assertEqual(result.ending, 'burned', 'an existing ending never gets overwritten');
}

// Complicit: a clean bulletin substituting another suspect's portrait frames them instead of ending normally.
{
  const framedConfig = config({ substitutedPortrait: 'DR-4417' });
  const result = resolveIssue(baseState, bulletin({ config: framedConfig }), verdict({ outcome: 'clean', heatDelta: -20 }));
  assertEqual(result.ending, 'complicit', 'a clean, substituted-portrait bulletin ends the run complicit');
  assertEqual(result.screen, { kind: 'epilogue', framed: 'DR-4417' }, 'complicit routes to the framed suspect\'s epilogue');
}

// Suspicion increments per technique used, regardless of whose case it is.
{
  const gradedConfig = config({ look: 'archival' });
  const result = resolveIssue(baseState, bulletin({ suspect: 'DR-4417', config: gradedConfig }), verdict());
  assertEqual(result.suspicion, { ...ZERO_SUSPICION, grade: 1 }, 'grading a non-operator bulletin still bumps suspicion');
}

// Bulletins prepend, newest first.
{
  const first = bulletin({ controlNumber: 'LSP-AAA-001' as Bulletin['controlNumber'] });
  const afterFirst = resolveIssue(baseState, first, verdict());
  const second = bulletin({ controlNumber: 'LSP-BBB-002' as Bulletin['controlNumber'] });
  const afterSecond = resolveIssue({ ...baseState, bulletins: afterFirst.bulletins }, second, verdict());
  assertEqual(afterSecond.bulletins.map((b) => b.controlNumber), ['LSP-BBB-002', 'LSP-AAA-001'], 'newest bulletin is prepended');
}

// Reveal flips exactly once, on the case that crosses the threshold.
{
  const belowThreshold = resolveIssue({ ...baseState, casesClosed: CASES_BEFORE_REVEAL - 2 }, bulletin({ suspect: 'DR-4417' }), verdict());
  assertEqual(belowThreshold.revealed, false, 'still below the reveal threshold');
  assertEqual(belowThreshold.justRevealed, false, 'no reveal cue below the threshold');

  const crossing = resolveIssue({ ...baseState, casesClosed: CASES_BEFORE_REVEAL - 1 }, bulletin({ suspect: 'DR-4417' }), verdict());
  assertEqual(crossing.revealed, true, 'crosses the reveal threshold');
  assertTruthy(crossing.justRevealed, 'reveal cue fires exactly on the crossing bulletin');

  const alreadyRevealed = resolveIssue({ ...baseState, casesClosed: CASES_BEFORE_REVEAL, revealed: true }, bulletin({ suspect: 'DR-4417' }), verdict());
  assertEqual(alreadyRevealed.justRevealed, false, 'no repeat reveal cue once already revealed');
}

console.log('issue.test.ts: ok');
