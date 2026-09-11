export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * A grade mutates the pixel buffer in place. No canvas API inside -- that's
 * what makes it a pure (data, size) => void, testable without a DOM and
 * portable to a Web Worker over OffscreenCanvas.
 */
export type Grade = (data: Uint8ClampedArray, size: Size) => void;

export interface Look {
  /** How hard this look pushes the composite -- read by scoring/recognition.ts. */
  readonly intensity: number;
  readonly grade: Grade;
}
