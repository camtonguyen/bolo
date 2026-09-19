// Run with: npm run test
import { readCoverage, overlayFootprint } from './markerCoverage';
import type { CompositeConfig } from '../canvas/pipeline';
import { MARKERS } from '../data/markers';
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

// Tamper is priced by footprint: the widest stamp is ~0.074 of the plate (0.55 wide, 3:1, on a 1000x1360 plate).
assertEqual(overlayFootprint(config()), 0, 'no overlays, no footprint');
{
  const area = overlayFootprint(config({ overlays: [{ id: 'tampered', x: 0.5, y: 0.5 }] }));
  assertTruthy(Math.abs(area - 0.0741) < 0.0005, `widest stamp footprint is about 0.074, got ${area}`);
  const two = overlayFootprint(config({ overlays: [{ id: 'tampered', x: 0.5, y: 0.5 }, { id: 'tampered', x: 0.2, y: 0.2 }] }));
  assertTruthy(Math.abs(two - 2 * area) < 1e-9, 'footprints add across overlays');
}

console.log('markerCoverage.test.ts: ok');
