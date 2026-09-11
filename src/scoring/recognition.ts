import type { CompositeConfig } from '../canvas/pipeline';
import { LOOKS } from '../canvas/looks';
import type { SuspectId } from '../data/suspects';
import { coverageMatch, overlayCanvasRect } from './markerCoverage';
import type { Suspicion } from './technique';
import type { Act } from '../state/act';

/**
 * The game mechanic. Reads the SAME serializable config the compositor
 * produces — no separate machinery, no image analysis.
 *
 * Doctor the portrait enough that recognition drops, without doctoring it so
 * obviously that the bulletin reads as tampered.
 */
export interface Verdict {
  readonly match: number;
  readonly tamper: number;
  readonly outcome: 'clean' | 'flagged' | 'identified';
  readonly heatDelta: number;
}

const MATCH_THRESHOLD = 40;
const TAMPER_THRESHOLD = 60;

/**
 * Tamper accrues per technique used, not per marker obscured — match is
 * suspect- and placement-specific (see markerCoverage.ts), but the cost of
 * having graded or stamped the plate at all isn't. Retuned against the new
 * coverage-based match (the old flat per-overlay tamper cost was calibrated
 * for a system where no single overlay could swing match by more than a few
 * points; under coverage scoring one big stamp can wipe out most of a
 * suspect's markers in one placement, so a flat cost made "pick the widest
 * stamp" a free win). Overlay tamper now scales with how much of the plate
 * the stamp actually covers — a small seal is low-risk because it's low
 * coverage, not because overlays are cheap. Grade stays a flat scale by
 * intensity: its "region" is the whole frame, not a footprint.
 */
const TAMPER = {
  /** Tamper at full (degraded) grade intensity. Medium, per the doc's ordering. */
  GRADE_MAX: 35,
  /** Tamper per unit of an overlay's own canvas-normalized area. High: the widest stamp (~0.07 area) lands near 50 alone. */
  OVERLAY_AREA_SCALE: 700,
} as const;

const overlayTamper = (config: CompositeConfig): number =>
  config.overlays.reduce((sum, placement) => {
    const rect = overlayCanvasRect(placement);
    return sum + rect.w * rect.h * TAMPER.OVERLAY_AREA_SCALE;
  }, 0);

/**
 * Reyes's whole mechanic: a technique costs more tamper each time it's
 * already been used. `priorUses` is the count BEFORE this bulletin -- the
 * first time you grade a plate is free of this penalty, the second time
 * isn't, because it's the second time that makes it a pattern.
 */
const SUSPICION_WEIGHT = 0.12;
const suspicionMultiplier = (priorUses: number): number => 1 + priorUses * SUSPICION_WEIGHT;

/** Act III: Internal Affairs is watching, on top of whatever Reyes already suspects. Flat, on the whole tamper total, not per-technique. */
const ACT_III_SCRUTINY_MULTIPLIER = 1.25;

export function evaluate(config: CompositeConfig, suspect: SuspectId, suspicion: Suspicion, act: Act): Verdict {
  const grade = gradeIntensity(config);

  // A substituted portrait carries none of this suspect's markers at all --
  // there's nothing to obscure, coverage doesn't apply. Tamper stays
  // whatever grade/overlays the player also stacked on; substitution itself
  // costs nothing there, since the photo is a genuine one.
  const match = config.substitutedPortrait ? 0 : clamp(coverageMatch(suspect, config, grade));
  const gradeTamper = grade * TAMPER.GRADE_MAX * suspicionMultiplier(suspicion.grade);
  const overlayTamperTotal = overlayTamper(config) * suspicionMultiplier(suspicion.overlay);
  const scrutiny = act === 'III' ? ACT_III_SCRUTINY_MULTIPLIER : 1;
  const tamper = clamp((gradeTamper + overlayTamperTotal) * scrutiny);

  if (tamper >= TAMPER_THRESHOLD) {
    return { match, tamper, outcome: 'flagged', heatDelta: 25 };
  }
  if (match >= MATCH_THRESHOLD) {
    return { match, tamper, outcome: 'identified', heatDelta: 15 };
  }
  return { match, tamper, outcome: 'clean', heatDelta: -20 };
}

const gradeIntensity = (c: CompositeConfig): number => LOOKS[c.look].intensity;

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));
