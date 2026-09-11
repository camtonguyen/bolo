// Shared by every *.test.ts file run through scripts/run-tests.mjs.
// Deep-compares via JSON.stringify so object/array actuals work, not just primitives.
export function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertTruthy(actual: unknown, label: string): void {
  if (!actual) throw new Error(`${label}: expected a truthy value, got ${JSON.stringify(actual)}`);
}
