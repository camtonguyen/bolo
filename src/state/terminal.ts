import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { OPERATOR_RECORD_ID, type SuspectId } from '../data/suspects';
import type { CompositeConfig } from '../canvas/pipeline';
import type { Verdict } from '../scoring/recognition';
import { ZERO_SUSPICION, type Suspicion } from '../scoring/technique';
import { deriveAct, type Act } from './act';
import type { Ending } from './ending';
import { resolveIssue } from './issue';
import type { ControlNumber, OperatorId } from '../lib/brand';
import { MAX_STORED_BULLETINS, PERSIST_VERSION, parsePersistedState, type PersistedState } from './parse';
import { playAlertTone, playSquelch } from '../audio/sound';

/**
 * Screen as a discriminated union — illegal states are unrepresentable.
 * You cannot be on the queue and hold a suspect id at the same time.
 */
export type Screen =
  | { kind: 'boot' }
  | { kind: 'login' }
  | { kind: 'queue' }
  | { kind: 'record'; suspect: SuspectId }
  | { kind: 'compose'; suspect: SuspectId }
  | { kind: 'verdict'; suspect: SuspectId; verdict: Verdict }
  | { kind: 'board' }
  | { kind: 'epilogue'; framed: SuspectId }
  | { kind: 'ending'; ending: Exclude<Ending, 'complicit'> };

export interface Bulletin {
  suspect: SuspectId;
  controlNumber: ControlNumber;
  posterDataUrl: string;
  config: CompositeConfig;
  issuedAt: number;
}

/**
 * An in-world confirmation overlaid on top of whatever screen is active.
 *
 * Not a Screen variant: aborting a discard-bulletin prompt on `compose` must
 * return to the composer with ComposerStage's local canvas/plate state
 * intact, and a Screen change would unmount it to get there. Not a boolean
 * `showConfirm` either: a lone flag can't say what's being confirmed, which
 * is exactly what the next prompt kind will need — this union is where that
 * grows.
 */
export type Prompt = { kind: 'discard-bulletin' };

/** Heat shed per decay tick — small, so cooling down reads as gradual, not a reset. */
const HEAT_DECAY_PER_TICK = 2;
/** How often the decay tick fires. Exported so the effect that drives it doesn't hardcode the interval it's syncing to. */
export const HEAT_DECAY_INTERVAL_MS = 5000;

interface TerminalState {
  screen: Screen;
  operator: OperatorId | null;
  casesClosed: number;
  revealed: boolean;
  /** Whether the player has opened the operator record since it was revealed — dismisses the dispatch notification. */
  operatorNoticed: boolean;
  heat: number;
  bulletins: Bulletin[];
  prompt: Prompt | null;
  muted: boolean;
  /** How many times the player has used each technique across every bulletin issued — read by evaluate() to price reuse. */
  suspicion: Suspicion;
  /** Whether any operator bulletin has ever been flagged. Never reverts to false. Drives deriveAct(). */
  operatorFlagged: boolean;
  /** Set once, on whichever operator bulletin first closes the run. Never overwritten after -- see state/ending.ts. */
  ending: Ending | null;

  boot: () => void;
  login: (operator: OperatorId) => void;
  openRecord: (suspect: SuspectId) => void;
  compose: (suspect: SuspectId) => void;
  issue: (bulletin: Bulletin, verdict: Verdict) => void;
  decayHeat: () => void;
  goQueue: () => void;
  goBoard: () => void;
  requestPrompt: (prompt: Prompt) => void;
  resolvePrompt: (action: 'abort' | 'continue') => void;
  toggleMuted: () => void;
}

const STORAGE_KEY = 'bolo-terminal';

/**
 * A hand-rolled PersistStorage instead of zustand's default JSON storage so
 * parsePersistedState runs on every read -- localStorage is unknown until
 * proven otherwise (a hand-edited entry, or a future schema this version
 * doesn't recognise), and nothing here may throw or half-apply.
 */
const storage: PersistStorage<PersistedState> = {
  getItem: (name) => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(name);
    } catch {
      return null;
    }
    if (raw === null) return null;

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return null;
    }
    if (typeof json !== 'object' || json === null) return null;
    const { state, version } = json as { state?: unknown; version?: unknown };

    const parsed = parsePersistedState(state);
    if (!parsed) return null;
    return { state: parsed, version: typeof version === 'number' ? version : PERSIST_VERSION };
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled -- the session keeps running in memory.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

export const useTerminal = create<TerminalState>()(
  persist(
    (set, get) => ({
      screen: { kind: 'boot' },
      operator: null,
      casesClosed: 0,
      revealed: false,
      operatorNoticed: false,
      heat: 0,
      bulletins: [],
      prompt: null,
      muted: true,
      suspicion: ZERO_SUSPICION,
      operatorFlagged: false,
      ending: null,

      boot: () => set({ screen: { kind: 'login' } }),
      login: (operator) => set({ operator, screen: { kind: 'queue' } }),
      openRecord: (suspect) =>
        set((s) => ({
          screen: { kind: 'record', suspect },
          operatorNoticed: s.operatorNoticed || suspect === OPERATOR_RECORD_ID,
        })),
      // No try again for a better ending -- once the run has closed, the operator's own record can't be reopened for editing. Defense in depth alongside RecordView hiding the button.
      compose: (suspect) =>
        set((s) => (suspect === OPERATOR_RECORD_ID && s.ending ? {} : { screen: { kind: 'compose', suspect } })),
      goQueue: () => set({ screen: { kind: 'queue' } }),
      goBoard: () => set({ screen: { kind: 'board' } }),
      requestPrompt: (prompt) => set({ prompt }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      resolvePrompt: (action) =>
        set((s) => {
          if (action !== 'abort' || !s.prompt) return { prompt: null };
          const kind = s.prompt.kind;
          switch (kind) {
            case 'discard-bulletin':
              return { prompt: null, screen: { kind: 'queue' } };
            default: {
              // Exhaustiveness: adding a Prompt variant without handling it fails the build.
              const never: never = kind;
              throw new Error(`Unhandled prompt: ${never}`);
            }
          }
        }),

      // Thin adapter: resolveIssue (state/issue.ts) decides heat, stickiness,
      // screen routing, and suspicion; this applies the result and runs the
      // one side effect (audio) that decision implies.
      issue: (bulletin, verdict) => {
        const { justRevealed, ...patch } = resolveIssue(get(), bulletin, verdict);
        set(patch);
        playSquelch();
        if (justRevealed) playAlertTone();
      },

      decayHeat: () => set((s) => ({ heat: clampHeat(s.heat - HEAT_DECAY_PER_TICK) })),
    }),
    {
      name: STORAGE_KEY,
      version: PERSIST_VERSION,
      storage,
      // Only what should survive a reload -- screen, prompt, and
      // operatorNoticed stay session-local so the terminal always re-boots
      // into login rather than resuming mid-composition.
      partialize: (s) => ({
        bulletins: s.bulletins.slice(0, MAX_STORED_BULLETINS),
        casesClosed: s.casesClosed,
        revealed: s.revealed,
        heat: s.heat,
        operator: s.operator,
        muted: s.muted,
        suspicion: s.suspicion,
        operatorFlagged: s.operatorFlagged,
        ending: s.ending,
      }),
    },
  ),
);

const clampHeat = (n: number): number => Math.max(0, Math.min(100, n));

/** Derives the current act on every read rather than storing it -- see state/act.ts. */
export function useAct(): Act {
  const revealed = useTerminal((s) => s.revealed);
  const operatorFlagged = useTerminal((s) => s.operatorFlagged);
  return deriveAct(revealed, operatorFlagged);
}
