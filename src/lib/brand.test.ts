// Run with: npm run test
// No framework — two constructors, plain asserts are enough.
import { parseOperatorId, parseControlNumber, generateControlNumber } from './brand';
import { assertEqual, assertTruthy } from '../test/assert';

assertEqual(parseOperatorId('op12'), 'OP12', 'trims and uppercases valid input');
assertEqual(parseOperatorId('  op12  '), 'OP12', 'trims surrounding whitespace');
assertEqual(parseOperatorId(''), null, 'rejects empty input');
assertEqual(parseOperatorId('OP1'), null, 'rejects below the minimum length');
assertEqual(parseOperatorId('X'.repeat(9)), null, 'rejects above the maximum length');
assertEqual(parseOperatorId('OP-12'), null, 'rejects characters outside A-Z0-9');
assertEqual(parseOperatorId('OP 123'), null, 'rejects a space');
assertEqual(parseOperatorId('OP1234'), 'OP1234', 'accepts letters and digits within range');

const a = generateControlNumber();
const b = generateControlNumber();
assertTruthy(/^LSP-[0-9A-Z]+-[0-9A-Z]{3}$/.test(a), 'matches the LSP-<stamp>-<suffix> format');
if (a === b) throw new Error('two generated control numbers collided');

assertEqual(parseControlNumber(a), a, 'accepts a real generated control number');
assertEqual(parseControlNumber('LSP-ABC123-XYZ'), 'LSP-ABC123-XYZ', 'accepts the general LSP-<stamp>-<suffix> shape');
assertEqual(parseControlNumber('lsp-abc123-xyz'), null, 'rejects lowercase');
assertEqual(parseControlNumber('LSP-ABC123-XY'), null, 'rejects a short suffix');
assertEqual(parseControlNumber('ABC123-XYZ'), null, 'rejects a missing LSP prefix');
assertEqual(parseControlNumber(42), null, 'rejects a non-string');

console.log('brand.test.ts: ok');
