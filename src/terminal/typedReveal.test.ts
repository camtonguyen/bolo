// Run with: npm run test
import { currentLineIndex, revealLines } from './typedReveal';
import { assertEqual } from '../test/assert';

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

const lines = ['AB', '', 'CDE'];

assertDeepEqual(revealLines(lines, 0), ['', '', ''], 'nothing revealed yet');
assertDeepEqual(revealLines(lines, 1), ['A', '', ''], 'partway through the first line');
assertDeepEqual(revealLines(lines, 2), ['AB', '', ''], 'first line exactly done, blank line untouched');
assertDeepEqual(revealLines(lines, 4), ['AB', '', 'CD'], 'blank line costs nothing, second line picks up');
assertDeepEqual(revealLines(lines, 5), ['AB', '', 'CDE'], 'fully revealed');
assertDeepEqual(revealLines(lines, 99), ['AB', '', 'CDE'], 'clamps past the total');

assertEqual(currentLineIndex(lines, 0), 0, 'cursor starts on the first line');
assertEqual(currentLineIndex(lines, 2), 0, 'cursor stays on line 0 at its exact boundary');
assertEqual(currentLineIndex(lines, 3), 2, 'cursor skips the blank line, not stranded on it');
assertEqual(currentLineIndex(lines, 5), 2, 'cursor ends on the last line, not a trailing blank');

const withTrailingBlank = ['AB', ''];
assertEqual(
  currentLineIndex(withTrailingBlank, 2),
  0,
  'a trailing blank line never steals the cursor from the last real line',
);

console.log('typedReveal.test.ts: ok');
