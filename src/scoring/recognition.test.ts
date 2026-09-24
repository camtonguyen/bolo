// Run with: npm run test
import { evaluate } from './recognition';
import type { CompositeConfig } from '../canvas/pipeline';
import { ZERO_SUSPICION } from './technique';
import { NO_EDITOR_EDITS } from './markerCoverage';
import { assertEqual } from '../test/assert';

const base = (look: CompositeConfig['look'], overlays: CompositeConfig['overlays'] = []): CompositeConfig => ({
  version: 1,
  look,
  overlays,
  bountyText: '',
  substitutedPortrait: null,
});

// Untouched raw plate never obscures anything -- full match, zero tamper, regardless of suspect.
assertEqual(
  evaluate(base('raw'), 'DR-0001', ZERO_SUSPICION, 'I', NO_EDITOR_EDITS),
  { match: 100, tamper: 0, outcome: 'identified', heatDelta: 15 },
  'raw, no edits',
);

// Grade alone barely dents match (only genuinely small markers qualify -- see markerCoverage.ts),
// but still costs tamper proportional to intensity.
assertEqual(
  evaluate(base('archival'), 'DR-0001', ZERO_SUSPICION, 'I', NO_EDITOR_EDITS),
  { match: 100, tamper: 14, outcome: 'identified', heatDelta: 15 },
  'archival alone: no small-enough marker to obscure',
);
assertEqual(
  evaluate(base('degraded'), 'DR-0001', ZERO_SUSPICION, 'I', NO_EDITOR_EDITS),
  { match: 100, tamper: 35, outcome: 'identified', heatDelta: 15 },
  "degraded alone: same, all of this suspect's markers are too large",
);

// The walk-away combo for the operator record (the central mechanic): one
// overlay, dragged onto the eyes/jawline band rather than left at its
// default position, clears both thresholds without grading at all.
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', ZERO_SUSPICION, 'I', NO_EDITOR_EDITS),
  { match: 20, tamper: 42, outcome: 'clean', heatDelta: -20 },
  'DR-0001: one well-placed overlay is enough to walk',
);

// Stacking grade and a big overlay overshoots into a flag -- tamper scales
// with the overlay's own footprint, so "hide everything" costs more than it buys.
assertEqual(
  evaluate(base('degraded', [{ id: 'tampered', x: 0.5, y: 0.5 }]), 'DR-0001', ZERO_SUSPICION, 'I', NO_EDITOR_EDITS).outcome,
  'flagged',
  'DR-0001: degraded plus the widest overlay floods tamper',
);

// Substitution carries none of this suspect's markers -- match drops to
// zero regardless of technique, and costs no tamper of its own (a genuine
// photo, just not of this suspect).
assertEqual(
  evaluate({ ...base('raw'), substitutedPortrait: 'DR-4417' }, 'DR-0001', ZERO_SUSPICION, 'I', NO_EDITOR_EDITS),
  { match: 0, tamper: 0, outcome: 'clean', heatDelta: -20 },
  'substituted portrait zeroes match with no extra tamper',
);

// Reyes: reusing a technique costs more tamper each time. The same overlay
// that walked clean at zero prior uses floods into a flag once it's the
// suspect's fifth time relying on it -- same edit, worse outcome, because
// it's a pattern now.
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 0, substitution: 0 }, 'I', NO_EDITOR_EDITS).tamper,
  42,
  'first-ever overlay use: no suspicion penalty',
);
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 4, substitution: 0 }, 'I', NO_EDITOR_EDITS).tamper,
  62,
  'fifth overlay use: suspicion multiplier pushes tamper up',
);

// Act III: Internal Affairs applies its own flat scrutiny multiplier on top
// of Reyes's per-technique one -- the same edit, at the same suspicion
// count, costs more once Internal Affairs is watching than it did before.
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 2, substitution: 0 }, 'II', NO_EDITOR_EDITS).outcome,
  'clean',
  'Act II: third overlay use still walks',
);
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 2, substitution: 0 }, 'III', NO_EDITOR_EDITS).outcome,
  'flagged',
  'Act III: same edit, same suspicion, scrutiny multiplier tips it into a flag',
);

// DR-0001's markers: hairline 25, jawline 30, eyes 25, ears 20.

// A change spread evenly over the whole plate -- one of the SDK's own
// filters, say -- hides nobody. Every region moved as much as the frame did,
// so no feature stands out as concealed: full match, and it pays tamper for
// disturbing the document. This is the case the old whole-frame average got
// backwards, scoring a global wash as if it were a disguise.
assertEqual(
  evaluate(base('raw'), 'DR-0001', ZERO_SUSPICION, 'I', {
    frame: 0.5,
    regions: { 'operator-hairline': 0.5, 'operator-jawline': 0.5, 'operator-eyes': 0.5, 'operator-ears': 0.5 },
  }),
  { match: 100, tamper: 28, outcome: 'identified', heatDelta: 15 },
  'a global filter costs tamper and hides nothing',
);

// The inverse, and the point of the whole mechanic: three small, precise
// redactions drawn over specific features barely move the frame average, but
// they take those features off the bulletin. Two isn't enough to clear the
// match threshold on this record -- the heaviest pair is only 55.
const redacted = (frame: number, ...hidden: string[]) => ({
  frame,
  regions: Object.fromEntries(hidden.map((id) => [id, 0.6])),
});

assertEqual(
  evaluate(base('raw'), 'DR-0001', ZERO_SUSPICION, 'I', redacted(0.03, 'operator-jawline', 'operator-eyes')),
  { match: 45, tamper: 34, outcome: 'identified', heatDelta: 15 },
  'two features redacted: still recognisable, and already paying for it',
);

assertEqual(
  evaluate(
    base('raw'),
    'DR-0001',
    ZERO_SUSPICION,
    'I',
    redacted(0.03, 'operator-jawline', 'operator-eyes', 'operator-ears'),
  ),
  { match: 25, tamper: 50, outcome: 'clean', heatDelta: -20 },
  'three features redacted with the editor alone: under both thresholds, the narrowest walk in the game',
);

// Act III closes that path: the same three redactions, scored under Internal
// Affairs scrutiny, tip over the tamper line.
assertEqual(
  evaluate(
    base('raw'),
    'DR-0001',
    ZERO_SUSPICION,
    'III',
    redacted(0.03, 'operator-jawline', 'operator-eyes', 'operator-ears'),
  ).outcome,
  'flagged',
  'Act III: the editor-only walk stops working',
);

// A marker already hidden by a stamp isn't charged again for also being
// drawn over -- tamper is identical to the overlay-only walk above.
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', ZERO_SUSPICION, 'I', {
    frame: 0,
    regions: { 'operator-eyes': 0.6 },
  }).tamper,
  42,
  'redrawing over what an overlay already covers costs nothing extra',
);

console.log('recognition.test.ts: ok');
