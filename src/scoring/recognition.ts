import type { CompositeConfig } from '../canvas/pipeline';
import { LOOKS } from '../canvas/looks';
import type { SuspectId } from '../data/suspects';
import { overlayFootprint, readCoverage, type EditorReading } from './markerCoverage';
import type { Suspicion } from './technique';
import { actPolicy, type Act } from '../state/act';

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
  /**
   * Tamper at a full (1.0) whole-frame delta. This is the blunt term: how
   * much the plate changed overall once it left the compositor, whatever
   * tool did it. A global filter lands here and nowhere else -- it disturbs
   * the document without hiding anybody.
   */
  EDITOR_FRAME_MAX: 55,
  /**
   * Tamper per marker the editor's own tools hid on their own. A neat black
   * box over one eye barely moves the frame average, which is exactly why a
   * reviewing officer notices it: this is the term that makes a precise
   * redaction a risk rather than a free win.
   *
   * Tuned so the cheapest editor-only walk on the operator's record (three
   * markers, the fewest that drop match under the threshold) lands just
   * under a flag -- and tips over it under Act III scrutiny.
   */
  EDITOR_MARKER: 16,
} as const;

const overlayTamper = (config: CompositeConfig): number => overlayFootprint(config) * TAMPER.OVERLAY_AREA_SCALE;

/**
 * Reyes's whole mechanic: a technique costs more tamper each time it's
 * already been used. `priorUses` is the count BEFORE this bulletin -- the
 * first time you grade a plate is free of this penalty, the second time
 * isn't, because it's the second time that makes it a pattern.
 */
const SUSPICION_WEIGHT = 0.12;
const suspicionMultiplier = (priorUses: number): number => 1 + priorUses * SUSPICION_WEIGHT;

/**
 * `editor` is the forensic-diff reading from EditorPanel's poll of the SDK's
 * own getImage() -- see src/canvas/diff.ts. It's the only visibility into
 * what the player did with the editor's own crop/text/draw/sticker tools, so
 * it's threaded through as its own parameter rather than folded into
 * CompositeConfig, which those tools never touch.
 *
 * Match is read entirely off coverage, the same readout the composer's
 * marker overlay draws from -- an in-editor edit costs recognition by hiding
 * a specific feature, never by averaging across the plate. Blacking out the
 * margins is not a disguise.
 */
export function evaluate(
  config: CompositeConfig,
  suspect: SuspectId,
  suspicion: Suspicion,
  act: Act,
  editor: EditorReading,
): Verdict {
  const grade = gradeIntensity(config);

  // A substituted portrait zeroes match (readCoverage reads every marker as
  // obscured). Tamper stays whatever grade/overlays/in-editor edits the
  // player also stacked on; substitution itself costs nothing there, since
  // the photo is a genuine one.
  const coverage = readCoverage(suspect, config, editor);
  const match = clamp(coverage.match);
  const gradeTamper = grade * TAMPER.GRADE_MAX * suspicionMultiplier(suspicion.grade);
  const overlayTamperTotal = overlayTamper(config) * suspicionMultiplier(suspicion.overlay);
  const editorTamper = editor.frame * TAMPER.EDITOR_FRAME_MAX + coverage.editorObscured * TAMPER.EDITOR_MARKER;
  // Act III: Internal Affairs is watching, on top of whatever Reyes already suspects. Flat, on the whole tamper total, not per-technique.
  const tamper = clamp((gradeTamper + overlayTamperTotal + editorTamper) * actPolicy(act).tamperScrutiny);

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
