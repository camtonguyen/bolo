import type { CompositeConfig } from '../canvas/pipeline';

/**
 * No 'crop' -- the SDK exposes no way to read a crop rect back out of the
 * editor, only the final flattened image (see markerCoverage.ts's isObscured
 * for the same reasoning on the scoring side). CompositeConfig has nothing
 * to derive a crop technique from, so the type doesn't carry one.
 */
export type Technique = 'grade' | 'overlay' | 'substitution';

const TECHNIQUES: readonly Technique[] = ['grade', 'overlay', 'substitution'];

export type Suspicion = Record<Technique, number>;

export const ZERO_SUSPICION: Suspicion = { grade: 0, overlay: 0, substitution: 0 };

/**
 * Techniques must be read off the config itself, not tracked as separate
 * state -- two sources of truth for "what did the player just do" will
 * drift. The scoring engine and Reyes's suspicion tracking both call this.
 */
export function deriveTechniques(config: CompositeConfig): readonly Technique[] {
  const used: Technique[] = [];
  if (config.look !== 'raw') used.push('grade');
  if (config.overlays.length > 0) used.push('overlay');
  if (config.substitutedPortrait !== null) used.push('substitution');
  return used;
}

/** Bumps the count for every technique this bulletin used -- called once per issued bulletin, in state/terminal.ts. */
export function incrementSuspicion(suspicion: Suspicion, used: readonly Technique[]): Suspicion {
  if (used.length === 0) return suspicion;
  const next = { ...suspicion };
  for (const technique of used) next[technique] += 1;
  return next;
}

export function isTechnique(value: unknown): value is Technique {
  return typeof value === 'string' && (TECHNIQUES as readonly string[]).includes(value);
}

/** Which of the given techniques has the highest prior-use count -- the one Reyes calls out. Null if none were used. */
export function mostSuspicious(used: readonly Technique[], suspicion: Suspicion): Technique | null {
  if (used.length === 0) return null;
  return used.reduce((a, b) => (suspicion[b] > suspicion[a] ? b : a));
}
