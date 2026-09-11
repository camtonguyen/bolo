import { gradeCapped } from './core';
import type { LookId, Size } from '../looks';
import type { FromWorker, ToWorker } from './types';

function workerSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
}

let worker: Worker | null = null;

function getWorker(): Worker {
  worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function requestGrade(w: Worker, look: LookId, buffer: ArrayBuffer, size: Size): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };
    const onMessage = (event: MessageEvent<FromWorker>) => {
      cleanup();
      if (event.data.kind === 'done') resolve(new Uint8ClampedArray(event.data.buffer));
      else reject(new Error(event.data.message));
    };
    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(event.error instanceof Error ? event.error : new Error(event.message));
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);

    const toWorker: ToWorker = { kind: 'grade', look, buffer, size };
    w.postMessage(toWorker, [buffer]);
  });
}

// One grade in flight at a time -- the wire protocol has no request id to
// match overlapping responses against, so overlapping calls queue instead.
let queue: Promise<unknown> = Promise.resolve();

function gradeInWorker(data: Uint8ClampedArray, look: LookId, size: Size): Promise<Uint8ClampedArray> {
  const run = () => requestGrade(getWorker(), look, data.buffer, size);
  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function makeMainThreadCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function gradeOnMainThread(data: Uint8ClampedArray, look: LookId, size: Size): Promise<Uint8ClampedArray> {
  return Promise.resolve(gradeCapped(data, look, size, makeMainThreadCanvas));
}

/**
 * Runs a look's grade off the main thread when Worker + OffscreenCanvas are
 * both available, falling back to running it inline otherwise. Callers never
 * touch postMessage -- they hand over a buffer and get one back, either way.
 * The buffer is transferred, not copied: `data` is unusable after this call.
 */
export function gradeOffThread(data: Uint8ClampedArray, look: LookId, size: Size): Promise<Uint8ClampedArray> {
  return workerSupported() ? gradeInWorker(data, look, size) : gradeOnMainThread(data, look, size);
}
