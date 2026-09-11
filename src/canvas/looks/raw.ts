import type { Grade } from './types';

export const intensity = 0;

/**
 * Identity. The caller (pipeline.ts) skips getImageData/putImageData and
 * this call entirely when look === 'raw' -- this function exists only so
 * the LOOKS registry stays complete, never so it can be invoked in a loop.
 */
export const grade: Grade = () => {};
