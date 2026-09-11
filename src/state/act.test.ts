// Run with: npm run test
import { deriveAct } from './act';
import { assertEqual } from '../test/assert';

assertEqual(deriveAct(false, false), 'I', 'not revealed, never flagged: Act I');
assertEqual(deriveAct(true, false), 'II', 'revealed, never flagged: Act II');
assertEqual(deriveAct(true, true), 'III', 'revealed and flagged: Act III');
assertEqual(deriveAct(false, true), 'III', 'flagged always wins even if revealed were somehow false: no reverting');

console.log('act.test.ts: ok');
