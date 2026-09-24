// Run with: npm run test
import { NO_EDITOR_EDITS } from '../scoring/markerCoverage';
import { resolveIssue, type IssueInput, type IssueResult } from './issue';
import type { Bulletin } from './terminal';
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

// Real configs, real outcomes -- the verdict is derived inside resolveIssue now, so fixtures
// are edits a player can actually make, not hand-built verdicts. Numbers are for the operator
// record (recognition.test.ts pins them): raw is identified, glare over the eyes walks clean
// (match 20, tamper 42), degraded plus the widest stamp floods tamper into a flag.
const IDENTIFIED = config();
const CLEAN = config({ overlays: [{ id: 'glare', x: 0.5, y: 0.4 }] });
const FLAGGED = config({ look: 'degraded', overlays: [{ id: 'tampered', x: 0.5, y: 0.5 }] });

const baseState: IssueInput = {
  bulletins: [],
  casesClosed: 0,
  heat: 0,
  suspicion: ZERO_SUSPICION,
  operatorFlagged: false,
  ending: null,
  revealed: false,
};

/** The verdict the run routed to the verdict screen with -- fails loudly if it routed elsewhere. */
function shownVerdict(result: IssueResult) {
  if (result.screen.kind !== 'verdict') throw new Error(`expected the verdict screen, got ${result.screen.kind}`);
  return result.screen.verdict;
}

// A non-operator suspect never touches heat, flag status, or ending -- only
// suspicion and the bulletin log move.
{
  const result = resolveIssue(baseState, bulletin({ suspect: 'DR-4417', config: FLAGGED }), NO_EDITOR_EDITS);
  assertEqual(shownVerdict(result).outcome, 'flagged', 'the issued config, not a caller-supplied verdict, decides the outcome');
  assertEqual(result.heat, 0, 'non-operator case leaves heat untouched');
  assertEqual(result.ending, null, 'non-operator case never sets an ending');
  assertEqual(result.operatorFlagged, false, 'non-operator flag does not set operatorFlagged');
  assertEqual(result.screen.kind, 'verdict', 'non-operator case always routes to verdict');
}

// A clean operator bulletin below the heat-decay floor closes the run clean.
{
  const result = resolveIssue(baseState, bulletin({ config: CLEAN }), NO_EDITOR_EDITS);
  assertEqual(result.heat, 0, 'heat clamps at zero, never negative');
  assertEqual(result.ending, 'clean', 'clean outcome under the heat floor ends the run clean');
  assertEqual(result.screen, { kind: 'ending', ending: 'clean' }, 'a clean ending routes straight to the ending screen');
}

// Being recognised on the operator's own record closes the run.
{
  const result = resolveIssue(baseState, bulletin({ config: IDENTIFIED }), NO_EDITOR_EDITS);
  assertEqual(result.ending, 'identified', 'an untouched operator plate is identified');
  assertEqual(result.heat, 15, 'identified heatDelta applied');
}

// A flagged operator bulletin sets operatorFlagged and heat, but only burns at 100 heat.
{
  const result = resolveIssue(baseState, bulletin({ config: FLAGGED }), NO_EDITOR_EDITS);
  assertEqual(result.heat, 25, 'flagged heatDelta applied to a starting heat of 0');
  assertEqual(result.operatorFlagged, true, 'a flagged operator bulletin sets operatorFlagged permanently');
  assertEqual(result.ending, null, 'flagged below 100 heat does not end the run');
  assertEqual(shownVerdict(result).outcome, 'flagged', 'still routes to the normal verdict screen');
}

{
  const result = resolveIssue({ ...baseState, heat: 90 }, bulletin({ config: FLAGGED }), NO_EDITOR_EDITS);
  assertEqual(result.heat, 100, 'heat clamps at 100');
  assertEqual(result.ending, 'burned', 'flagged at max heat burns the run');
  assertEqual(result.screen, { kind: 'ending', ending: 'burned' }, 'burned routes to the ending screen');
}

// Sticky: once an ending is set, a later bulletin can't clear or change it, even with a clean outcome.
{
  const result = resolveIssue({ ...baseState, ending: 'burned' }, bulletin({ config: CLEAN }), NO_EDITOR_EDITS);
  assertEqual(result.ending, 'burned', 'an existing ending never gets overwritten');
}

// Complicit: a clean bulletin substituting another suspect's portrait frames them instead of ending normally.
{
  const framedConfig = config({ substitutedPortrait: 'DR-4417' });
  const result = resolveIssue(baseState, bulletin({ config: framedConfig }), NO_EDITOR_EDITS);
  assertEqual(result.ending, 'complicit', 'a clean, substituted-portrait bulletin ends the run complicit');
  assertEqual(result.screen, { kind: 'epilogue', framed: 'DR-4417' }, 'complicit routes to the framed suspect\'s epilogue');
}

// The verdict reads the run's own history, so the same edit lands differently as the run goes on.
{
  const first = resolveIssue(baseState, bulletin({ config: CLEAN }), NO_EDITOR_EDITS);
  assertEqual(first.ending, 'clean', 'first-ever overlay use walks clean');

  // Reyes: reusing a technique costs more tamper each time -- the same stamp floods once it's a pattern.
  const reused = resolveIssue({ ...baseState, suspicion: { ...ZERO_SUSPICION, overlay: 4 } }, bulletin({ config: CLEAN }), NO_EDITOR_EDITS);
  assertEqual(reused.operatorFlagged, true, 'a fifth overlay use is flagged: suspicion comes from state, not the caller');

  // Act III (operatorFlagged) adds Internal Affairs' own scrutiny on top of Reyes's; Act II does not.
  const suspicious = { ...ZERO_SUSPICION, overlay: 2 };
  const actII = resolveIssue({ ...baseState, revealed: true, suspicion: suspicious }, bulletin({ config: CLEAN }), NO_EDITOR_EDITS);
  assertEqual(actII.operatorFlagged, false, 'same edit and suspicion is not flagged before Internal Affairs is watching');
  const actIII = resolveIssue({ ...baseState, revealed: true, operatorFlagged: true, suspicion: suspicious }, bulletin({ config: CLEAN }), NO_EDITOR_EDITS);
  assertEqual(shownVerdict(actIII).outcome, 'flagged', 'same edit and suspicion is flagged in Act III');
}

// The forensic reading of the editor's own crop/text/draw tools reaches the verdict as tamper.
{
  const untouched = resolveIssue(baseState, bulletin({ config: CLEAN }), NO_EDITOR_EDITS);
  assertEqual(untouched.operatorFlagged, false, 'no in-editor edits: the stamp alone stays under the tamper line');
  const edited = resolveIssue(baseState, bulletin({ config: CLEAN }), { frame: 0.5, regions: {} });
  assertEqual(edited.operatorFlagged, true, 'heavy in-editor edits on top of the stamp push tamper over the line');
}

// Suspicion increments per technique used, regardless of whose case it is.
{
  const gradedConfig = config({ look: 'archival' });
  const result = resolveIssue(baseState, bulletin({ suspect: 'DR-4417', config: gradedConfig }), NO_EDITOR_EDITS);
  assertEqual(result.suspicion, { ...ZERO_SUSPICION, grade: 1 }, 'grading a non-operator bulletin still bumps suspicion');
}

// Bulletins prepend, newest first.
{
  const first = bulletin({ suspect: 'DR-4417', controlNumber: 'LSP-AAA-001' as Bulletin['controlNumber'] });
  const afterFirst = resolveIssue(baseState, first, NO_EDITOR_EDITS);
  const second = bulletin({ suspect: 'DR-4417', controlNumber: 'LSP-BBB-002' as Bulletin['controlNumber'] });
  const afterSecond = resolveIssue({ ...baseState, bulletins: afterFirst.bulletins }, second, NO_EDITOR_EDITS);
  assertEqual(afterSecond.bulletins.map((b) => b.controlNumber), ['LSP-BBB-002', 'LSP-AAA-001'], 'newest bulletin is prepended');
}

// Reveal flips exactly once, on the case that crosses the threshold.
{
  const belowThreshold = resolveIssue({ ...baseState, casesClosed: CASES_BEFORE_REVEAL - 2 }, bulletin({ suspect: 'DR-4417' }), NO_EDITOR_EDITS);
  assertEqual(belowThreshold.revealed, false, 'still below the reveal threshold');
  assertEqual(belowThreshold.justRevealed, false, 'no reveal cue below the threshold');

  const crossing = resolveIssue({ ...baseState, casesClosed: CASES_BEFORE_REVEAL - 1 }, bulletin({ suspect: 'DR-4417' }), NO_EDITOR_EDITS);
  assertEqual(crossing.revealed, true, 'crosses the reveal threshold');
  assertTruthy(crossing.justRevealed, 'reveal cue fires exactly on the crossing bulletin');

  const alreadyRevealed = resolveIssue({ ...baseState, casesClosed: CASES_BEFORE_REVEAL, revealed: true }, bulletin({ suspect: 'DR-4417' }), NO_EDITOR_EDITS);
  assertEqual(alreadyRevealed.justRevealed, false, 'no repeat reveal cue once already revealed');
}

console.log('issue.test.ts: ok');
