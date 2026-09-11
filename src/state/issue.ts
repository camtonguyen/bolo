import { OPERATOR_RECORD_ID, CASES_BEFORE_REVEAL } from '../data/suspects';
import type { Verdict } from '../scoring/recognition';
import { deriveTechniques, incrementSuspicion, type Suspicion } from '../scoring/technique';
import { deriveEnding, type Ending } from './ending';
import type { Bulletin, Screen } from './terminal';

export interface IssueInput {
  readonly bulletins: readonly Bulletin[];
  readonly casesClosed: number;
  readonly heat: number;
  readonly suspicion: Suspicion;
  readonly operatorFlagged: boolean;
  readonly ending: Ending | null;
  readonly revealed: boolean;
}

export interface IssueResult {
  readonly bulletins: Bulletin[];
  readonly casesClosed: number;
  readonly heat: number;
  readonly suspicion: Suspicion;
  readonly operatorFlagged: boolean;
  readonly ending: Ending | null;
  readonly screen: Screen;
  readonly revealed: boolean;
  /** True only the instant `revealed` flips from false to true -- the caller's cue to play the alert tone. */
  readonly justRevealed: boolean;
}

const clampHeat = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Pure core of the "issue a bulletin" transition: heat, sticky endings,
 * screen routing, and suspicion tracking, all decided in one place and
 * testable without a live store. state/terminal.ts's `issue()` action is a
 * thin adapter that applies the returned state and runs the audio side
 * effects `justRevealed` and `screen` imply.
 */
export function resolveIssue(state: IssueInput, bulletin: Bulletin, verdict: Verdict): IssueResult {
  const isOperatorCase = bulletin.suspect === OPERATOR_RECORD_ID;
  // Reyes reviews every bulletin, not just the operator's -- the suspicion
  // she's built up by the operator's own turn comes from the player's
  // habits across the whole queue.
  const usedTechniques = deriveTechniques(bulletin.config);

  const heat = isOperatorCase ? clampHeat(state.heat + verdict.heatDelta) : state.heat;
  // Sticky: once a run-ending condition is met, it stays met even if heat
  // later decays back under the threshold that produced it.
  const ending = state.ending ?? (isOperatorCase ? deriveEnding(verdict, bulletin.config, heat) : null);
  const framed = bulletin.config.substitutedPortrait;

  // A "complicit" close shows the framed suspect's own record, not the
  // operator's -- and walking on a substituted portrait always skips the
  // normal verdict entirely: recognition/tamper bars right before "someone
  // else was just arrested for this" would read as a celebration, not a cost.
  let screen: Screen;
  if (ending === 'complicit') {
    // deriveEnding only ever returns 'complicit' when substitutedPortrait is set, so framed is non-null here.
    screen = framed ? { kind: 'epilogue', framed } : { kind: 'verdict', suspect: bulletin.suspect, verdict };
  } else if (ending) {
    screen = { kind: 'ending', ending };
  } else {
    screen = { kind: 'verdict', suspect: bulletin.suspect, verdict };
  }

  const casesClosed = state.casesClosed + 1;
  const revealed = state.revealed || casesClosed >= CASES_BEFORE_REVEAL;

  return {
    bulletins: [bulletin, ...state.bulletins],
    casesClosed,
    heat,
    suspicion: incrementSuspicion(state.suspicion, usedTechniques),
    operatorFlagged: state.operatorFlagged || (isOperatorCase && verdict.outcome === 'flagged'),
    ending,
    screen,
    revealed,
    justRevealed: !state.revealed && revealed,
  };
}
