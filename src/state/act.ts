export type Act = 'I' | 'II' | 'III';

/**
 * Not stored independently — always computed from revealed + operatorFlagged,
 * so there's no way to represent a contradictory combination (Act III with
 * revealed still false, say).
 *
 * Act III doesn't revert once entered: getting flagged once is a permanent
 * shift in how the terminal treats the player, not a temporary state that
 * clears on the next clean bulletin — that's what makes the tension compound
 * instead of reset.
 */
export function deriveAct(revealed: boolean, operatorFlagged: boolean): Act {
  if (operatorFlagged) return 'III';
  if (revealed) return 'II';
  return 'I';
}

export interface ActPolicy {
  /** Flat multiplier Internal Affairs applies on top of Reyes's own per-technique scrutiny. */
  readonly tamperScrutiny: number;
  /** Dispatch takes longer to respond -- Internal Affairs slows everything down. */
  readonly slowDispatch: boolean;
  /** Reyes has stopped explaining herself -- shorter every time, not just this one. */
  readonly reyesTerse: boolean;
  /** A standing mark once Act III begins, independent of whatever heat happens to read right now. */
  readonly showInternalAffairsBadge: boolean;
}

/**
 * Everything that changes about the terminal once Act III begins, in one
 * place -- the scrutiny multiplier, dispatch pacing, Reyes's tone, and the
 * status badge were each an independent `act === 'III'` check before this.
 */
export function actPolicy(act: Act): ActPolicy {
  const actIII = act === 'III';
  return {
    tamperScrutiny: actIII ? 1.25 : 1,
    slowDispatch: actIII,
    reyesTerse: actIII,
    showInternalAffairsBadge: actIII,
  };
}
