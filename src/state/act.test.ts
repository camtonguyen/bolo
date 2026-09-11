// Run with: npm run test
import { deriveAct, actPolicy } from './act';
import { assertEqual } from '../test/assert';

assertEqual(deriveAct(false, false), 'I', 'not revealed, never flagged: Act I');
assertEqual(deriveAct(true, false), 'II', 'revealed, never flagged: Act II');
assertEqual(deriveAct(true, true), 'III', 'revealed and flagged: Act III');
assertEqual(deriveAct(false, true), 'III', 'flagged always wins even if revealed were somehow false: no reverting');

assertEqual(
  actPolicy('II'),
  { tamperScrutiny: 1, slowDispatch: false, reyesTerse: false, showInternalAffairsBadge: false },
  'Act II: no Internal Affairs effects yet',
);
assertEqual(
  actPolicy('III'),
  { tamperScrutiny: 1.25, slowDispatch: true, reyesTerse: true, showInternalAffairsBadge: true },
  'Act III: every Internal Affairs effect is on',
);

console.log('act.test.ts: ok');
