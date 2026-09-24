import * as raw from './raw';
import * as archival from './archival';
import * as microfilm from './microfilm';
import * as degraded from './degraded';
import type { Look } from './types';

export type { Size, Grade, Look } from './types';

export const LOOKS = { raw, archival, microfilm, degraded } satisfies Record<string, Look>;

export type LookId = keyof typeof LOOKS;
