import { gradeCapped } from './core';
import type { FromWorker, ToWorker } from './types';

/**
 * Typed by hand instead of pulling in the "webworker" lib -- mixing it with
 * this project's "dom" lib produces conflicting global declarations. `self`
 * really is a DedicatedWorkerGlobalScope at runtime; this is just its shape.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  postMessage(message: FromWorker): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { look, buffer, size } = event.data;
  try {
    const graded = gradeCapped(new Uint8ClampedArray(buffer), look, size, (w, h) => new OffscreenCanvas(w, h));
    const response: FromWorker = { kind: 'done', buffer: graded.buffer };
    scope.postMessage(response, [graded.buffer]);
  } catch (error) {
    const response: FromWorker = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    scope.postMessage(response);
  }
};
