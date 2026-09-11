/**
 * CRT shell effect timings and magnitudes — single source of truth.
 * TerminalShell mirrors these into CSS custom properties; nothing else
 * hardcodes a blur radius, offset, or interval.
 */
export const CRT_MOTION = {
  /** Phosphor text-shadow. Small near layer keeps it crisp at 11px UI text. */
  bloom: {
    nearBlurPx: 1,
    nearOpacity: 0.85,
    farBlurPx: 4,
    farOpacity: 0.3,
  },
  /** Corner/edge darkening that reads as curved glass, without warping DOM content. */
  barrel: {
    innerStopPct: 84,
    darkenOpacity: 0.28,
  },
  /** Red/cyan channel split near the edge, layered on top of the barrel darkening. */
  fringe: {
    offsetPx: 4,
    ringStopPct: 95,
    ringOpacity: 0.14,
  },
  /** One rendered frame of dimmed brightness, on a randomised ~8s average interval. */
  flicker: {
    avgIntervalMs: 8000,
    jitterMs: 5000,
    brightnessDelta: 0.08,
  },
} as const;

/** Pure so the ~8s-average claim is testable without waiting 8 seconds. */
export function nextFlickerDelayMs(rand: () => number = Math.random): number {
  const { avgIntervalMs, jitterMs } = CRT_MOTION.flicker;
  return avgIntervalMs - jitterMs + rand() * jitterMs * 2;
}

/** Boot sequence typed-reveal timings. */
export const BOOT_MOTION = {
  charIntervalMs: 18,
  /** Ignore keydowns before this so a stray keypress can't skip the boot the instant it mounts. */
  skipAfterMs: 600,
  /** Beat to read the final line before auto-advancing to login. */
  holdAfterMs: 500,
} as const;

/** Verdict screen timings. */
export const VERDICT_MOTION = {
  /** How long the recognition/tamper bars take to fill from zero. The dispatch response waits for this before it appears. */
  barFillMs: 600,
  /** Act III: dispatch is slower to come back once Internal Affairs is watching -- everything about the terminal drags. */
  barFillMsActIII: 1400,
} as const;
