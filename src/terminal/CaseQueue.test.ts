// Run with: npm run test
import { DEFAULT_DIRECTIONS, matchesQuery, sortRows, type SuspectRow } from './CaseQueue';
import { assertEqual } from '../test/assert';

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

// Suspect's fields are narrowed to the real cast's literal values, which the
// fixtures below don't match exactly — a cast is fine for test-only shapes.
const rows = [
  { id: 'DR-4419', name: 'Teodor Rusk', alias: 'Shortwave', charge: 'Wire fraud', bounty: 78_000, portrait: '', lastSeen: '' },
  { id: 'DR-4417', name: 'Marisol Vega', alias: 'The Cartographer', charge: 'Grand larceny', bounty: 45_000, portrait: '', lastSeen: '' },
  { id: 'DR-4423', name: 'Ines Aboyade', alias: 'Nine Volt', charge: 'Arson', bounty: 32_000, portrait: '', lastSeen: '' },
] as unknown as SuspectRow[];

assertDeepEqual(
  sortRows(rows, { column: 'bounty', direction: 'desc' }).map((r) => r.id),
  ['DR-4419', 'DR-4417', 'DR-4423'],
  'sorts bounty descending',
);
assertDeepEqual(
  sortRows(rows, { column: 'bounty', direction: 'asc' }).map((r) => r.id),
  ['DR-4423', 'DR-4417', 'DR-4419'],
  'sorts bounty ascending',
);
assertDeepEqual(
  sortRows(rows, { column: 'name', direction: 'asc' }).map((r) => r.id),
  ['DR-4423', 'DR-4417', 'DR-4419'],
  'sorts name alphabetically, not by insertion order',
);
assertDeepEqual(sortRows(rows, { column: 'id', direction: 'asc' }), rows.slice().sort((a, b) => a.id.localeCompare(b.id)), 'id sort matches a plain locale compare');
assertEqual(sortRows(rows, { column: 'bounty', direction: 'desc' }) === rows, false, 'does not mutate or alias the input array');

assertEqual(matchesQuery(rows[0], ''), true, 'empty query matches everything');
assertEqual(matchesQuery(rows[0], 'shortwave'), true, 'matches on alias, case-insensitively');
assertEqual(matchesQuery(rows[0], 'wire'), true, 'matches on charge');
assertEqual(matchesQuery(rows[0], 'dr-4419'), true, 'matches on id, case-insensitively');
assertEqual(matchesQuery(rows[0], 'nonexistent'), false, 'rejects a non-matching query');

assertEqual(DEFAULT_DIRECTIONS.bounty, 'desc', 'bounty defaults to descending on first click');
assertEqual(DEFAULT_DIRECTIONS.name, 'asc', 'name defaults to ascending on first click');

console.log('CaseQueue.test.ts: ok');
