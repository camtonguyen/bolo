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
