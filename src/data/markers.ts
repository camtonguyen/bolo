import type { SuspectId } from './suspects';

/**
 * Hand-authored per portrait — regions can't be derived from geometry since
 * portraits are generated raster images, not drawn parts. Refined with the
 * dev-only authoring tool at src/dev/MarkerAuthoringTool.tsx (visit
 * /#markers-tool in dev mode).
 */
export type NormalizedRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

/**
 * Weighted per suspect: deliberately uneven across the cast so no single
 * technique (crop the top, blur the middle) clears every profile. See the
 * per-suspect comments below for which feature carries the weight.
 */
const MARKERS = {
  // Sunglasses already hide the eyes in the source portrait, so weight sits in hairline/jaw instead.
  'DR-4417': [
    {
      id: 'voss-hairline',
      label: 'hairline, bangs',
      weight: 30,
      region: { x: 0.22, y: 0.01, w: 0.64, h: 0.21 },
    },
    {
      id: 'voss-jawline',
      label: 'jawline',
      weight: 30,
      region: { x: 0.22, y: 0.48, w: 0.56, h: 0.14 },
    },
    {
      id: 'voss-mouth',
      label: 'mouth',
      weight: 20,
      region: { x: 0.45, y: 0.4, w: 0.2, h: 0.08 },
    },
    {
      id: 'voss-ear',
      label: 'ear, left',
      weight: 20,
      region: { x: 0.19, y: 0.32, w: 0.12, h: 0.14 },
    },
  ],
  // Jaw-heavy: the forehead scar is the other big tell, brow and both ears carry the rest.
  'DR-4419': [
    {
      id: 'kovic-jawline',
      label: 'jawline',
      weight: 40,
      region: { x: 0.2, y: 0.45, w: 0.6, h: 0.26 },
    },
    {
      id: 'kovic-forehead-scar',
      label: 'scar, forehead',
      weight: 30,
      region: { x: 0.23, y: 0.02, w: 0.34, h: 0.19 },
    },
    {
      id: 'kovic-brow',
      label: 'brow',
      weight: 15,
      region: { x: 0.24, y: 0.18, w: 0.52, h: 0.11 },
    },
    {
      id: 'kovic-ears',
      label: 'ears',
      weight: 15,
      region: { x: 0.06, y: 0.26, w: 0.88, h: 0.14 },
    },
  ],
  'DR-4423': [
    {
      id: 'pruitt-ears',
      label: 'ears',
      weight: 35,
      region: { x: 0.02, y: 0.3, w: 0.96, h: 0.16 },
    },
    {
      id: 'pruitt-mouth',
      label: 'mouth, gap tooth',
      weight: 25,
      region: { x: 0.32, y: 0.4, w: 0.36, h: 0.12 },
    },
    {
      id: 'pruitt-eyes',
      label: 'eyes',
      weight: 20,
      region: { x: 0.28, y: 0.23, w: 0.44, h: 0.09 },
    },
    {
      id: 'pruitt-chin',
      label: 'chin',
      weight: 20,
      region: { x: 0.31, y: 0.58, w: 0.36, h: 0.09 },
    },
  ],
  // Spread evenly on purpose — no single obscure-one-region move clears her.
  'DR-4425': [
    {
      id: 'ashcroft-hairline',
      label: 'hairline, updo',
      weight: 20,
      region: { x: 0.14, y: 0.02, w: 0.7, h: 0.18 },
    },
    {
      id: 'ashcroft-brow',
      label: 'brow',
      weight: 20,
      region: { x: 0.3, y: 0.33, w: 0.46, h: 0.07 },
    },
    {
      id: 'ashcroft-mole',
      label: 'mole, left cheek',
      weight: 20,
      region: { x: 0.41, y: 0.55, w: 0.07, h: 0.05 },
    },
    {
      id: 'ashcroft-jawline',
      label: 'jawline',
      weight: 20,
      region: { x: 0.25, y: 0.64, w: 0.56, h: 0.11 },
    },
    {
      id: 'ashcroft-mouth',
      label: 'mouth',
      weight: 20,
      region: { x: 0.49, y: 0.56, w: 0.16, h: 0.08 },
    },
  ],
  'DR-4428': [
    {
      id: 'bregman-glasses',
      label: 'eyes, glasses',
      weight: 35,
      region: { x: 0.28, y: 0.27, w: 0.6, h: 0.16 },
    },
    {
      id: 'bregman-hairline',
      label: 'hairline',
      weight: 30,
      region: { x: 0.14, y: 0.02, w: 0.7, h: 0.16 },
    },
    {
      id: 'bregman-brow',
      label: 'brow',
      weight: 15,
      region: { x: 0.3, y: 0.22, w: 0.52, h: 0.06 },
    },
    {
      id: 'bregman-ears',
      label: 'ears',
      weight: 20,
      region: { x: 0.04, y: 0.32, w: 0.92, h: 0.16 },
    },
  ],
  'DR-4432': [
    {
      id: 'higgins-hairline',
      label: 'hairline, bandana',
      weight: 30,
      region: { x: 0.13, y: 0.0, w: 0.8, h: 0.2 },
    },
    {
      id: 'higgins-mole',
      label: 'mole, near mouth',
      weight: 25,
      region: { x: 0.61, y: 0.5, w: 0.07, h: 0.06 },
    },
    {
      id: 'higgins-mouth',
      label: 'mouth',
      weight: 25,
      region: { x: 0.35, y: 0.38, w: 0.3, h: 0.14 },
    },
    {
      id: 'higgins-ear',
      label: 'ears, earrings',
      weight: 20,
      region: { x: 0.14, y: 0.32, w: 0.7, h: 0.2 },
    },
  ],
  'DR-4436': [
    {
      id: 'lindqvist-hairline',
      label: 'hairline, waves',
      weight: 35,
      region: { x: 0.04, y: 0.0, w: 0.92, h: 0.24 },
    },
    {
      id: 'lindqvist-eyewear',
      label: 'eyes, glasses',
      weight: 30,
      region: { x: 0.22, y: 0.31, w: 0.56, h: 0.14 },
    },
    {
      id: 'lindqvist-mouth',
      label: 'lips',
      weight: 20,
      region: { x: 0.4, y: 0.45, w: 0.25, h: 0.1 },
    },
    {
      id: 'lindqvist-jawline',
      label: 'jawline',
      weight: 15,
      region: { x: 0.3, y: 0.52, w: 0.45, h: 0.12 },
    },
  ],
  'DR-4440': [
    {
      id: 'delroy-hairline',
      label: 'hairline, afro',
      weight: 35,
      region: { x: 0.06, y: 0.0, w: 0.88, h: 0.24 },
    },
    {
      id: 'delroy-goatee',
      label: 'goatee, chin',
      weight: 25,
      region: { x: 0.39, y: 0.63, w: 0.28, h: 0.08 },
    },
    {
      id: 'delroy-mouth',
      label: 'mouth, gap tooth',
      weight: 20,
      region: { x: 0.3, y: 0.45, w: 0.4, h: 0.12 },
    },
    {
      id: 'delroy-ears',
      label: 'ears',
      weight: 20,
      region: { x: 0.02, y: 0.36, w: 0.96, h: 0.14 },
    },
  ],
  'DR-4443': [
    {
      id: 'callahan-hairline',
      label: 'hairline, disheveled',
      weight: 25,
      region: { x: 0.1, y: 0.0, w: 0.8, h: 0.2 },
    },
    {
      id: 'callahan-jawline',
      label: 'jawline, stubble',
      weight: 30,
      region: { x: 0.35, y: 0.57, w: 0.4, h: 0.13 },
    },
    {
      id: 'callahan-mouth',
      label: 'mouth, cigarette',
      weight: 25,
      region: { x: 0.35, y: 0.47, w: 0.5, h: 0.1 },
    },
    {
      id: 'callahan-eyes',
      label: 'eyes',
      weight: 20,
      region: { x: 0.27, y: 0.34, w: 0.45, h: 0.09 },
    },
  ],
  'DR-4447': [
    {
      id: 'kessler-hairline',
      label: 'hairline, curls',
      weight: 30,
      region: { x: 0.02, y: 0.0, w: 0.96, h: 0.22 },
    },
    {
      id: 'kessler-glasses',
      label: 'eyes, glasses',
      weight: 30,
      region: { x: 0.29, y: 0.3, w: 0.56, h: 0.16 },
    },
    {
      id: 'kessler-mustache',
      label: 'mustache',
      weight: 25,
      region: { x: 0.46, y: 0.48, w: 0.25, h: 0.08 },
    },
    {
      id: 'kessler-ears',
      label: 'ears',
      weight: 15,
      region: { x: 0.04, y: 0.4, w: 0.92, h: 0.14 },
    },
  ],
  'DR-4451': [
    {
      id: 'doyle-hairline',
      label: 'hairline, beanie',
      weight: 25,
      region: { x: 0.1, y: 0.0, w: 0.72, h: 0.26 },
    },
    {
      id: 'doyle-jawline',
      label: 'jawline, stubble',
      weight: 30,
      region: { x: 0.34, y: 0.5, w: 0.42, h: 0.18 },
    },
    {
      id: 'doyle-mouth',
      label: 'mouth, cigarette',
      weight: 25,
      region: { x: 0.45, y: 0.47, w: 0.45, h: 0.09 },
    },
    {
      id: 'doyle-eyes',
      label: 'eyes',
      weight: 20,
      region: { x: 0.38, y: 0.3, w: 0.35, h: 0.1 },
    },
  ],
  // Act two. Same beanie-and-stubble build as the rest of the cast — nothing about the profile shape gives away that this record is different.
  'DR-0001': [
    {
      id: 'operator-hairline',
      label: 'hairline, beanie',
      weight: 25,
      region: { x: 0.14, y: 0.0, w: 0.72, h: 0.28 },
    },
    {
      id: 'operator-jawline',
      label: 'jawline, stubble',
      weight: 30,
      region: { x: 0.22, y: 0.56, w: 0.56, h: 0.16 },
    },
    {
      id: 'operator-eyes',
      label: 'eyes',
      weight: 25,
      region: { x: 0.24, y: 0.33, w: 0.48, h: 0.11 },
    },
    {
      id: 'operator-ears',
      label: 'ears',
      weight: 20,
      region: { x: 0.04, y: 0.34, w: 0.92, h: 0.14 },
    },
  ],
} as const satisfies Record<
  SuspectId,
  readonly {
    id: string;
    label: string;
    weight: number;
    region: NormalizedRect;
  }[]
>;

export type MarkerId = (typeof MARKERS)[SuspectId][number]['id'];

export interface Marker {
  readonly id: MarkerId;
  readonly label: string;
  readonly weight: number;
  readonly region: NormalizedRect;
}

export { MARKERS };

/**
 * A profile that silently sums to 97 makes recognition math subtly wrong
 * everywhere it's used, with no error anywhere near the mistake — so this
 * fails fast, in dev, at the point the data is wrong rather than the point
 * it's consumed.
 */
if (import.meta.env.DEV) {
  for (const [suspectId, markers] of Object.entries(MARKERS) as [
    SuspectId,
    readonly Marker[],
  ][]) {
    const sum = markers.reduce((total, marker) => total + marker.weight, 0);
    if (sum !== 100) {
      throw new Error(`markers: ${suspectId} profile sums to ${sum}, not 100`);
    }
    for (const marker of markers) {
      const { x, y, w, h } = marker.region;
      const inBounds = x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1;
      if (!inBounds) {
        throw new Error(
          `markers: ${suspectId}/${marker.id} region falls outside 0-1`,
        );
      }
    }
  }
}
