import { isSuspectId } from '../data/suspects';
import { LOOK_IDS, OVERLAY_IDS, type CompositeConfig, type LookId, type OverlayId, type OverlayPlacement } from './pipeline';

const MAX_BOUNTY_TEXT_LENGTH = 60;

function isLookId(value: unknown): value is LookId {
  return typeof value === 'string' && (LOOK_IDS as readonly string[]).includes(value);
}

function isOverlayId(value: unknown): value is OverlayId {
  return typeof value === 'string' && (OVERLAY_IDS as readonly string[]).includes(value);
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isOverlayPlacement(value: unknown): value is OverlayPlacement {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return isOverlayId(candidate.id) && isUnitInterval(candidate.x) && isUnitInterval(candidate.y);
}

/**
 * Hand-rolled: the schema is four fields, and a validation library would
 * outweigh the object it validates. Returns null on anything unexpected —
 * never a partially-valid config, never a merge with defaults that would
 * hide corruption from the scoring engine.
 */
export function parseCompositeConfig(raw: unknown): CompositeConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;

  // The typeof/null check above only proves this is a non-null object, not a
  // shape TS can index — cast to read candidate fields, each checked below.
  const candidate = raw as Record<string, unknown>;
  const { version, look, overlays, bountyText, substitutedPortrait } = candidate;

  if (version !== 1) return null;
  if (!isLookId(look)) return null;
  if (!Array.isArray(overlays) || !overlays.every(isOverlayPlacement)) return null;
  if (typeof bountyText !== 'string' || bountyText.length >= MAX_BOUNTY_TEXT_LENGTH) return null;
  if (substitutedPortrait !== null && !isSuspectId(substitutedPortrait)) return null;

  return { version, look, overlays, bountyText, substitutedPortrait };
}
