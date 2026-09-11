import redactionBarUrl from './redaction-bar.svg';
import sealUrl from './seal.svg';
import evidenceTagUrl from './evidence-tag.svg';
import glareUrl from './glare.svg';
import tamperedUrl from './tampered.svg';

export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

export interface StampEntry {
  readonly url: string;
  /** width / height of the source SVG's own viewBox -- lets drawOverlay size it without distortion. */
  readonly aspectRatio: number;
  /** How wide this overlay renders, as a fraction of the plate's full width. */
  readonly widthFraction: number;
  /** Where it lands the first time it's added -- normalized to the full plate, so it survives a resolution change. */
  readonly defaultPosition: NormalizedPoint;
}

export const STAMPS = {
  'redaction-bar': {
    url: redactionBarUrl,
    aspectRatio: 5,
    widthFraction: 0.32,
    defaultPosition: { x: 0.5, y: 0.404 },
  },
  seal: {
    url: sealUrl,
    aspectRatio: 1,
    widthFraction: 0.12,
    defaultPosition: { x: 0.62, y: 0.6 },
  },
  'evidence-tag': {
    url: evidenceTagUrl,
    aspectRatio: 240 / 320,
    widthFraction: 0.12,
    defaultPosition: { x: 0.36, y: 0.62 },
  },
  glare: {
    url: glareUrl,
    aspectRatio: 200 / 500,
    widthFraction: 0.18,
    defaultPosition: { x: 0.5, y: 0.47 },
  },
  tampered: {
    url: tamperedUrl,
    aspectRatio: 3,
    widthFraction: 0.55,
    defaultPosition: { x: 0.5, y: 0.5 },
  },
} satisfies Record<string, StampEntry>;

export type OverlayId = keyof typeof STAMPS;
