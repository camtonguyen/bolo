// Run with: npm run test
import { parsePersistedState, MAX_STORED_BULLETINS } from './parse';
import { assertEqual } from '../test/assert';

const validConfig = {
  version: 1,
  look: 'archival',
  overlays: [],
  bountyText: 'REWARD $45,000',
  substitutedPortrait: null,
};

const validBulletin = {
  suspect: 'DR-4417',
  controlNumber: 'LSP-ABC123-XYZ',
  posterDataUrl: 'data:image/png;base64,x',
  config: validConfig,
  issuedAt: 1_700_000_000_000,
};

const valid = {
  bulletins: [validBulletin],
  casesClosed: 2,
  revealed: false,
  heat: 30,
  operator: 'OP1234',
  muted: true,
  suspicion: { grade: 3, overlay: 1, substitution: 0 },
  operatorFlagged: true,
  ending: 'burned',
};

assertEqual(parsePersistedState(valid), valid, 'valid state round-trips');
assertEqual(parsePersistedState({ ...valid, operator: null }), { ...valid, operator: null }, 'accepts a null operator');

assertEqual(parsePersistedState(null), null, 'rejects null');
assertEqual(parsePersistedState('nope'), null, 'rejects non-object');
assertEqual(parsePersistedState({}), null, 'rejects empty object');
assertEqual(parsePersistedState({ ...valid, bulletins: 'nope' }), null, 'rejects non-array bulletins');
assertEqual(parsePersistedState({ ...valid, bulletins: [{ ...validBulletin, suspect: 'DR-9999' }] }), null, 'rejects a bulletin for an unknown suspect');
assertEqual(parsePersistedState({ ...valid, bulletins: [{ ...validBulletin, controlNumber: 'not-a-control-number' }] }), null, 'rejects a bulletin with a malformed control number');
assertEqual(parsePersistedState({ ...valid, bulletins: [{ ...validBulletin, config: { ...validConfig, look: 'hd' } }] }), null, 'rejects a bulletin with an invalid nested config');
assertEqual(parsePersistedState({ ...valid, bulletins: [{ ...validBulletin, issuedAt: 'yesterday' }] }), null, 'rejects a bulletin with a non-numeric issuedAt');
// One corrupt bulletin fails the whole payload -- same never-partial rule as parseCompositeConfig -- rather than silently dropping it and keeping the rest.
assertEqual(parsePersistedState({ ...valid, bulletins: [validBulletin, { ...validBulletin, suspect: 'nope' }] }), null, 'one bad bulletin invalidates the whole payload');

assertEqual(parsePersistedState({ ...valid, casesClosed: -1 }), null, 'rejects negative casesClosed');
assertEqual(parsePersistedState({ ...valid, casesClosed: 1.5 }), null, 'rejects non-integer casesClosed');
assertEqual(parsePersistedState({ ...valid, revealed: 'yes' }), null, 'rejects non-boolean revealed');
assertEqual(parsePersistedState({ ...valid, heat: 101 }), null, 'rejects heat above 100');
assertEqual(parsePersistedState({ ...valid, heat: -1 }), null, 'rejects heat below 0');
assertEqual(parsePersistedState({ ...valid, heat: NaN }), null, 'rejects non-finite heat');
assertEqual(parsePersistedState({ ...valid, operator: 'op-bad' }), null, 'rejects a malformed operator id');
assertEqual(parsePersistedState({ ...valid, operator: 42 }), null, 'rejects a non-string, non-null operator');

// muted is a UI preference, not game state: unlike every field above, a
// missing or malformed value defaults rather than invalidating the payload.
const validWithoutMuted: Record<string, unknown> = { ...valid };
delete validWithoutMuted.muted;
assertEqual(parsePersistedState(validWithoutMuted), valid, 'defaults muted to true when absent (pre-existing saves)');
assertEqual(parsePersistedState({ ...valid, muted: 'nope' })?.muted, true, 'defaults muted to true when malformed');
assertEqual(parsePersistedState({ ...valid, muted: false })?.muted, false, 'preserves an explicit muted: false');

// suspicion is new since players already had saves -- same lenient-default reasoning as muted.
const ZERO_SUSPICION = { grade: 0, overlay: 0, substitution: 0 };
const validWithoutSuspicion: Record<string, unknown> = { ...valid };
delete validWithoutSuspicion.suspicion;
assertEqual(
  parsePersistedState(validWithoutSuspicion),
  { ...valid, suspicion: ZERO_SUSPICION },
  'defaults suspicion to zero when absent (pre-existing saves)',
);
assertEqual(parsePersistedState({ ...valid, suspicion: { grade: 'a lot' } })?.suspicion, ZERO_SUSPICION, 'defaults suspicion to zero when malformed');
assertEqual(parsePersistedState({ ...valid, suspicion: { grade: 5, overlay: 0, substitution: 0 } })?.suspicion, { grade: 5, overlay: 0, substitution: 0 }, 'preserves explicit suspicion counts');

// operatorFlagged is new too, same lenient-default reasoning.
const validWithoutOperatorFlagged: Record<string, unknown> = { ...valid };
delete validWithoutOperatorFlagged.operatorFlagged;
assertEqual(
  parsePersistedState(validWithoutOperatorFlagged),
  { ...valid, operatorFlagged: false },
  'defaults operatorFlagged to false when absent (pre-existing saves)',
);
assertEqual(parsePersistedState({ ...valid, operatorFlagged: 'nope' })?.operatorFlagged, false, 'defaults operatorFlagged to false when malformed');
assertEqual(parsePersistedState({ ...valid, operatorFlagged: false })?.operatorFlagged, false, 'preserves an explicit operatorFlagged: false even though valid has it true');

// ending is new too, same lenient-default reasoning -- defaults to null (run not over) rather than invalidating the payload.
const validWithoutEnding: Record<string, unknown> = { ...valid };
delete validWithoutEnding.ending;
assertEqual(parsePersistedState(validWithoutEnding), { ...valid, ending: null }, 'defaults ending to null when absent (pre-existing saves)');
assertEqual(parsePersistedState({ ...valid, ending: 'not-a-real-ending' })?.ending, null, 'defaults ending to null when malformed');
assertEqual(parsePersistedState({ ...valid, ending: 'clean' })?.ending, 'clean', 'preserves an explicit valid ending');

const overStuffed = {
  ...valid,
  bulletins: Array.from({ length: MAX_STORED_BULLETINS + 5 }, (_, i) => ({ ...validBulletin, issuedAt: i })),
};
assertEqual(parsePersistedState(overStuffed)?.bulletins.length, MAX_STORED_BULLETINS, 'caps bulletins at MAX_STORED_BULLETINS even on read');

console.log('state/parse.test.ts: ok');
