import type { LookId, Size } from '../looks';

export type ToWorker = { readonly kind: 'grade'; readonly look: LookId; readonly buffer: ArrayBuffer; readonly size: Size };

export type FromWorker =
  | { readonly kind: 'done'; readonly buffer: ArrayBuffer }
  | { readonly kind: 'error'; readonly message: string };
