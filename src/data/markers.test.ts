import { MARKERS, type Marker } from './markers';
import type { SuspectId } from './suspects';
import { assertTruthy } from '../test/assert';

for (const [suspectId, markers] of Object.entries(MARKERS) as [SuspectId, readonly Marker[]][]) {
  const sum = markers.reduce((total, marker) => total + marker.weight, 0);
  assertTruthy(sum === 100, `${suspectId} marker weights sum to ${sum}`);

  for (const marker of markers) {
    const { x, y, w, h } = marker.region;
    const inBounds = x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1;
    assertTruthy(inBounds, `${suspectId}/${marker.id} region in 0-1`);
  }
}

console.log('markers.test.ts: ok');
