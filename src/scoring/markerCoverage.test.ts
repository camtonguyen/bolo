// Run with: npm run test
import { readCoverage, overlayFootprint, markerRects } from './markerCoverage';
import { LOOK_IDS, type CompositeConfig } from '../canvas/pipeline';
import { MARKERS } from '../data/markers';
import type { SuspectId } from '../data/suspects';
import { assertEqual, assertTruthy } from '../test/assert';

const config = (overrides: Partial<CompositeConfig> = {}): CompositeConfig => ({
  version: 1,
  look: 'raw',
  overlays: [],
  bountyText: '',
  substitutedPortrait: null,
  ...overrides,
});

// One reading per marker, each carrying its own canvas-normalized rect -- what the composer's marker overlay draws.
{
  const { markers } = readCoverage('DR-0001', config());
  assertEqual(markers.length, MARKERS['DR-0001'].length, 'one reading per marker on file');
  assertTruthy(
    markers.every(({ rect }) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= 1 && rect.y + rect.h <= 1),
    'every marker rect sits inside the plate',
  );
}

// Numbers pinned independently in recognition.test.ts: raw and grade-only plates obscure nothing.
assertEqual(readCoverage('DR-0001', config()).match, 100, 'untouched plate: full match');
assertEqual(readCoverage('DR-0001', config({ look: 'degraded' })).match, 100, "degraded: DR-0001's markers are all too large to lose to grade");

// A stamp dragged over the eyes obscures markers, and the same readout says which ones and what that cost.
{
  const { markers, match } = readCoverage('DR-0001', config({ overlays: [{ id: 'glare', x: 0.5, y: 0.4 }] }));
  assertEqual(match, 20, 'one well-placed overlay drops match to 20');
  assertTruthy(markers.some((m) => m.obscured) && markers.some((m) => !m.obscured), 'some markers hidden, some still readable');
  assertEqual(
    markers.filter((m) => !m.obscured).reduce((sum, m) => sum + m.marker.weight, 0),
    match,
    'match is exactly the weight of the markers the overlay shows as readable',
  );
}

// A substituted portrait carries none of this suspect's markers: the readout says so, so the overlay can't draw them as live.
{
  const { markers, match } = readCoverage('DR-0001', config({ substitutedPortrait: 'DR-4417' }));
  assertEqual(match, 0, 'nothing of the original suspect is left to recognise');
  assertTruthy(markers.every((m) => m.obscured), 'every marker reads as obscured, matching the score');
}

// Grade loses detail in proportion to how hard the look pushes, so a middle
// treatment is a real choice and not just a dearer archival.
{
  const lost = (suspect: SuspectId, look: CompositeConfig['look']) =>
    readCoverage(suspect, config({ look }))
      .markers.filter((m) => m.obscured)
      .map((m) => m.marker.id);

  // The invariant, over the whole cast: a harder grade never gives a feature
  // back. Without it, "pick the heaviest look" could cost match somewhere.
  for (const suspect of Object.keys(MARKERS) as SuspectId[]) {
    const tiers = LOOK_IDS.map((look) => lost(suspect, look));
    for (let i = 1; i < tiers.length; i++) {
      assertTruthy(
        tiers[i - 1].every((id) => tiers[i].includes(id)),
        `${suspect}: ${LOOK_IDS[i]} keeps everything ${LOOK_IDS[i - 1]} already lost`,
      );
    }
    assertEqual(tiers[0], [], `${suspect}: raw loses nothing, whatever the cutoff scales to`);
  }

  // And the tiers are genuinely distinct, not three names for one cutoff.
  assertEqual(lost('DR-4417', 'archival'), ['voss-mouth'], 'archival costs Voss only her mouth');
  assertEqual(lost('DR-4417', 'microfilm'), ['voss-mouth', 'voss-ear'], 'microfilm costs her the ear as well');
  assertTruthy(
    lost('DR-4425', 'degraded').length > lost('DR-4425', 'microfilm').length,
    'and degraded still takes more than microfilm does',
  );
}

// markerRects is what the forensic poll measures against -- same rects the
// readout reports, so the poll can't end up measuring somewhere else.
{
  const rects = markerRects('DR-0001');
  assertEqual(
    rects.map((r) => r.id),
    readCoverage('DR-0001', config()).markers.map((m) => m.marker.id),
    'markerRects and readCoverage agree on which markers exist, in order',
  );
  assertEqual(
    rects.map((r) => r.rect),
    readCoverage('DR-0001', config()).markers.map((m) => m.rect),
    'and on where each one sits',
  );
}

// An in-editor edit hides a marker when its own region moved far more than
// the plate did. A global change -- every region moving with the frame --
// hides nothing, which is the whole reason the reading is an excess and not
// a raw delta.
{
  const local = readCoverage('DR-0001', config(), { frame: 0.02, regions: { 'operator-eyes': 0.6 } });
  assertEqual(local.markers.find((m) => m.marker.id === 'operator-eyes')?.obscured, true, 'a local redaction hides its feature');
  assertEqual(local.editorObscured, 1, 'and is counted as the editor having done it');
  assertEqual(local.match, 75, 'costing exactly that marker its weight');

  const global = readCoverage('DR-0001', config(), {
    frame: 0.6,
    regions: { 'operator-hairline': 0.6, 'operator-jawline': 0.6, 'operator-eyes': 0.6, 'operator-ears': 0.6 },
  });
  assertEqual(global.match, 100, 'a change spread evenly over the plate hides nobody');
  assertEqual(global.editorObscured, 0, 'and is not charged as a redaction');
}

// A marker an overlay already covers is not also counted against the editor.
{
  const both = readCoverage('DR-0001', config({ overlays: [{ id: 'glare', x: 0.5, y: 0.4 }] }), {
    frame: 0,
    regions: { 'operator-eyes': 0.6 },
  });
  const overlayOnly = readCoverage('DR-0001', config({ overlays: [{ id: 'glare', x: 0.5, y: 0.4 }] }));
  assertEqual(both.match, overlayOnly.match, 'drawing over a stamped marker changes nothing');
  assertEqual(both.editorObscured, 0, 'and is never double-counted');
}

// Tamper is priced by footprint: the widest stamp is ~0.074 of the plate (0.55 wide, 3:1, on a 1000x1360 plate).
assertEqual(overlayFootprint(config()), 0, 'no overlays, no footprint');
{
  const area = overlayFootprint(config({ overlays: [{ id: 'tampered', x: 0.5, y: 0.5 }] }));
  assertTruthy(Math.abs(area - 0.0741) < 0.0005, `widest stamp footprint is about 0.074, got ${area}`);
  const two = overlayFootprint(config({ overlays: [{ id: 'tampered', x: 0.5, y: 0.5 }, { id: 'tampered', x: 0.2, y: 0.2 }] }));
  assertTruthy(Math.abs(two - 2 * area) < 1e-9, 'footprints add across overlays');
}

console.log('markerCoverage.test.ts: ok');
