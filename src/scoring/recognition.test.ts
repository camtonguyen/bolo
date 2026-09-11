// Run with: npm run test
import { evaluate } from './recognition';
import type { CompositeConfig } from '../canvas/pipeline';
import { ZERO_SUSPICION } from './technique';
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
  evaluate(base('raw'), 'DR-0001', ZERO_SUSPICION, 'I'),
  { match: 100, tamper: 0, outcome: 'identified', heatDelta: 15 },
  'raw, no edits',
);

// Grade alone barely dents match (only genuinely small markers qualify -- see markerCoverage.ts),
// but still costs tamper proportional to intensity.
assertEqual(
  evaluate(base('archival'), 'DR-0001', ZERO_SUSPICION, 'I'),
  { match: 100, tamper: 14, outcome: 'identified', heatDelta: 15 },
  'archival alone: no small-enough marker to obscure',
);
assertEqual(
  evaluate(base('degraded'), 'DR-0001', ZERO_SUSPICION, 'I'),
  { match: 100, tamper: 35, outcome: 'identified', heatDelta: 15 },
  "degraded alone: same, all of this suspect's markers are too large",
);

// The walk-away combo for the operator record (the central mechanic): one
// overlay, dragged onto the eyes/jawline band rather than left at its
// default position, clears both thresholds without grading at all.
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', ZERO_SUSPICION, 'I'),
  { match: 20, tamper: 42, outcome: 'clean', heatDelta: -20 },
  'DR-0001: one well-placed overlay is enough to walk',
);

// Stacking grade and a big overlay overshoots into a flag -- tamper scales
// with the overlay's own footprint, so "hide everything" costs more than it buys.
assertEqual(
  evaluate(base('degraded', [{ id: 'tampered', x: 0.5, y: 0.5 }]), 'DR-0001', ZERO_SUSPICION, 'I').outcome,
  'flagged',
  'DR-0001: degraded plus the widest overlay floods tamper',
);

// Substitution carries none of this suspect's markers -- match drops to
// zero regardless of technique, and costs no tamper of its own (a genuine
// photo, just not of this suspect).
assertEqual(
  evaluate({ ...base('raw'), substitutedPortrait: 'DR-4417' }, 'DR-0001', ZERO_SUSPICION, 'I'),
  { match: 0, tamper: 0, outcome: 'clean', heatDelta: -20 },
  'substituted portrait zeroes match with no extra tamper',
);

// Reyes: reusing a technique costs more tamper each time. The same overlay
// that walked clean at zero prior uses floods into a flag once it's the
// suspect's fifth time relying on it -- same edit, worse outcome, because
// it's a pattern now.
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 0, substitution: 0 }, 'I').tamper,
  42,
  'first-ever overlay use: no suspicion penalty',
);
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 4, substitution: 0 }, 'I').tamper,
  62,
  'fifth overlay use: suspicion multiplier pushes tamper up',
);

// Act III: Internal Affairs applies its own flat scrutiny multiplier on top
// of Reyes's per-technique one -- the same edit, at the same suspicion
// count, costs more once Internal Affairs is watching than it did before.
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 2, substitution: 0 }, 'II').outcome,
  'clean',
  'Act II: third overlay use still walks',
);
assertEqual(
  evaluate(base('raw', [{ id: 'glare', x: 0.5, y: 0.4 }]), 'DR-0001', { grade: 0, overlay: 2, substitution: 0 }, 'III').outcome,
  'flagged',
  'Act III: same edit, same suspicion, scrutiny multiplier tips it into a flag',
);

console.log('recognition.test.ts: ok');
