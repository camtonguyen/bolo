declare const brand: unique symbol;

/** Nominal typing for primitives — T with an unforgeable tag, B. */
export type Brand<T, B> = T & { readonly [brand]: B };

export type OperatorId = Brand<string, 'OperatorId'>;

const OPERATOR_ID_PATTERN = /^[A-Z0-9]{4,8}$/;

/**
 * The only place that may assert a string is an OperatorId. Trims and
 * uppercases first so login input like "  op-12 " still validates.
 */
export function parseOperatorId(raw: string): OperatorId | null {
  const normalized = raw.trim().toUpperCase();
  if (!OPERATOR_ID_PATTERN.test(normalized)) return null;
  // Checked against the pattern above — this is the assertion the brand exists to contain.
  return normalized as OperatorId;
}

export type ControlNumber = Brand<string, 'ControlNumber'>;

const CONTROL_NUMBER_PATTERN = /^LSP-[0-9A-Z]+-[0-9A-Z]{3}$/;

/**
 * The persistence read boundary reads a ControlNumber back out of storage as
 * unknown, so generateControlNumber below is no longer the only place that
 * may assert the brand — this is the validating counterpart, checked
 * against the exact shape that function produces.
 */
export function parseControlNumber(raw: unknown): ControlNumber | null {
  if (typeof raw !== 'string' || !CONTROL_NUMBER_PATTERN.test(raw)) return null;
  return raw as ControlNumber;
}

/** Generates a fresh ControlNumber per composition. */
export function generateControlNumber(): ControlNumber {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0');
  // Built from a fixed format, not user input — this is the assertion the brand exists to contain.
  return `LSP-${stamp}-${suffix}` as ControlNumber;
}
