import type { SuspectId } from '../data/suspects';

export interface EditableMarker {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly region: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Matches markers.ts's own formatting exactly, so the output pastes in without reformatting. */
export function formatMarkersEntry(suspectId: SuspectId, markers: readonly EditableMarker[]): string {
  const lines = markers.map((m) => {
    const r = m.region;
    const region = `{ x: ${round(r.x)}, y: ${round(r.y)}, w: ${round(r.w)}, h: ${round(r.h)} }`;
    return `    { id: '${m.id}', label: '${m.label}', weight: ${m.weight}, region: ${region} },`;
  });
  return `  '${suspectId}': [\n${lines.join('\n')}\n  ],`;
}
