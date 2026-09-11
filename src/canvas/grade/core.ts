import { LOOKS } from '../looks';
import type { LookId, Size } from '../looks';

/** Grading is O(pixels), so bound it regardless of how large a plate gets. */
export const MAX_GRADE_EDGE = 1600;

export type GradeCanvas = OffscreenCanvas | HTMLCanvasElement;
export type CanvasFactory = (width: number, height: number) => GradeCanvas;

interface Grade2DContext {
  putImageData(data: ImageData, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

/** OffscreenCanvasRenderingContext2D and CanvasRenderingContext2D both satisfy this shape at runtime. */
function context2d(canvas: GradeCanvas): Grade2DContext {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  return ctx as unknown as Grade2DContext;
}

/**
 * Runs a look's grade, capping the working resolution at MAX_GRADE_EDGE and
 * scaling the result back up to `size`. A no-op resize at any size already
 * inside the cap -- today's fixed 1000x1360 plate never triggers it; this
 * exists so a larger plate later can't blow the grading budget.
 */
export function gradeCapped(source: Uint8ClampedArray, look: LookId, size: Size, makeCanvas: CanvasFactory): Uint8ClampedArray {
  const maxEdge = Math.max(size.width, size.height);
  if (maxEdge <= MAX_GRADE_EDGE) {
    const data = new Uint8ClampedArray(source);
    LOOKS[look].grade(data, size);
    return data;
  }

  const scale = MAX_GRADE_EDGE / maxEdge;
  const small: Size = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };

  const fullCanvas = makeCanvas(size.width, size.height);
  const fullCtx = context2d(fullCanvas);
  fullCtx.putImageData(new ImageData(source, size.width, size.height), 0, 0);

  const smallCanvas = makeCanvas(small.width, small.height);
  const smallCtx = context2d(smallCanvas);
  smallCtx.drawImage(fullCanvas, 0, 0, small.width, small.height);

  const smallImageData = smallCtx.getImageData(0, 0, small.width, small.height);
  LOOKS[look].grade(smallImageData.data, small);
  smallCtx.putImageData(smallImageData, 0, 0);

  fullCtx.drawImage(smallCanvas, 0, 0, size.width, size.height);
  return fullCtx.getImageData(0, 0, size.width, size.height).data;
}
