import { parseCompositeConfig } from '../canvas/parse';
import { isSuspectId } from '../data/suspects';
import { parseControlNumber, parseOperatorId, type OperatorId } from '../lib/brand';
import { ZERO_SUSPICION, type Suspicion } from '../scoring/technique';
import type { Ending } from './ending';
import type { Bulletin } from './terminal';

const ENDINGS: readonly Ending[] = ['clean', 'complicit', 'burned', 'identified'];
const isEnding = (v: unknown): v is Ending => typeof v === 'string' && (ENDINGS as readonly string[]).includes(v);

/**
 * Bumped whenever PersistedState's shape changes. Passed to zustand's
 * persist `version` option, which is what a future `migrate` branches on —
 * this file doesn't need its own migration logic until that first change.
 */
export const PERSIST_VERSION = 1;

/** localStorage quota isn't the constraint bulletins should ever hit — their dataUrls are. */
export const MAX_STORED_BULLETINS = 12;

/** The slice of TerminalState that survives a reload. */
export interface PersistedState {
  readonly bulletins: readonly Bulletin[];
  readonly casesClosed: number;
  readonly revealed: boolean;
  readonly heat: number;
  readonly operator: OperatorId | null;
  readonly muted: boolean;
  readonly suspicion: Suspicion;
  /** Whether any operator bulletin has ever been flagged — once true, stays true. Drives Act III; see state/act.ts. */
  readonly operatorFlagged: boolean;
  /** Set once, on whichever operator bulletin first closes the run — never overwritten after. See state/ending.ts. */
  readonly ending: Ending | null;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Same lenient-default reasoning as `muted`: a field added after players already had saves shouldn't invalidate those saves. */
function parseSuspicion(raw: unknown): Suspicion {
  if (typeof raw !== 'object' || raw === null) return ZERO_SUSPICION;
  const { grade, overlay, substitution } = raw as Record<string, unknown>;
  if (!isCount(grade) || !isCount(overlay) || !isCount(substitution)) return ZERO_SUSPICION;
  return { grade, overlay, substitution };
}

/** Same never-partial rule as parseCompositeConfig: one bad field fails the whole bulletin, never a silent default. */
function parseBulletin(raw: unknown): Bulletin | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  if (!isSuspectId(candidate.suspect)) return null;
  const controlNumber = parseControlNumber(candidate.controlNumber);
  if (!controlNumber) return null;
  if (typeof candidate.posterDataUrl !== 'string') return null;
  const config = parseCompositeConfig(candidate.config);
  if (!config) return null;
  if (typeof candidate.issuedAt !== 'number' || !Number.isFinite(candidate.issuedAt)) return null;

  return { suspect: candidate.suspect, controlNumber, posterDataUrl: candidate.posterDataUrl, config, issuedAt: candidate.issuedAt };
}

/**
 * The persistence read boundary. `raw` is whatever localStorage handed
 * back — a schema from a future version, a hand-edited entry, or garbage —
 * so every field is checked and a single invalid one fails the whole
 * payload rather than merging partial trust with defaults. Callers fall
 * back to initial state on null.
 */
export function parsePersistedState(raw: unknown): PersistedState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  if (!Array.isArray(candidate.bulletins)) return null;
  const bulletins: Bulletin[] = [];
  for (const entry of candidate.bulletins) {
    const bulletin = parseBulletin(entry);
    if (!bulletin) return null;
    bulletins.push(bulletin);
  }

  const { casesClosed, revealed, heat, operator } = candidate;
  if (typeof casesClosed !== 'number' || !Number.isInteger(casesClosed) || casesClosed < 0) return null;
  if (typeof revealed !== 'boolean') return null;
  if (typeof heat !== 'number' || !Number.isFinite(heat) || heat < 0 || heat > 100) return null;

  let parsedOperator: OperatorId | null = null;
  if (operator !== null) {
    if (typeof operator !== 'string') return null;
    parsedOperator = parseOperatorId(operator);
    if (!parsedOperator) return null;
  }

  // Leniently defaulted, unlike every field above: muted is a UI preference,
  // not game state, so a missing/malformed value shouldn't invalidate an
  // otherwise-valid payload (e.g. one saved before this field existed).
  const muted = typeof candidate.muted === 'boolean' ? candidate.muted : true;
  const suspicion = parseSuspicion(candidate.suspicion);
  // Same lenient-default reasoning as muted/suspicion: added after players already had saves.
  const operatorFlagged = typeof candidate.operatorFlagged === 'boolean' ? candidate.operatorFlagged : false;
  const ending = isEnding(candidate.ending) ? candidate.ending : null;

  return {
    bulletins: bulletins.slice(0, MAX_STORED_BULLETINS),
    casesClosed,
    revealed,
    heat,
    operator: parsedOperator,
    muted,
    suspicion,
    operatorFlagged,
    ending,
  };
}
