import type { Verdict } from '../scoring/recognition';
import type { CompositeConfig } from '../canvas/pipeline';

export type Ending = 'clean' | 'complicit' | 'burned' | 'identified';

/**
 * Whether this operator bulletin closes the run, and how. `null` means it
 * doesn't -- Act III exists precisely so a flag or elevated heat isn't
 * automatically fatal; the player continues under heavier scrutiny until
 * one of these conditions is actually met.
 *
 * `heatAfter` is heat post this bulletin's delta, not the value going in --
 * "heat maxed" and "heat < 50" describe where things land once this
 * attempt has been scored, not where they started.
 */
export function deriveEnding(verdict: Verdict, config: CompositeConfig, heatAfter: number): Ending | null {
  if (verdict.outcome === 'identified') return 'identified';
  if (verdict.outcome === 'flagged') return heatAfter >= 100 ? 'burned' : null;
  // outcome === 'clean'
  if (config.substitutedPortrait !== null) return 'complicit';
  return heatAfter < 50 ? 'clean' : null;
}
