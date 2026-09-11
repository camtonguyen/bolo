import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reveals `totalChars` of a flattened string over time as a single index —
 * one rAF loop, not per-line timers. `skip` cancels the loop and jumps
 * straight to the final frame, it does not fast-forward through it.
 */
export function useTypedReveal(totalChars: number, intervalMs: number) {
  const [revealedCount, setRevealedCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setRevealedCount(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealedCount(totalChars);
      return;
    }
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const count = Math.min(totalChars, Math.floor((t - start) / intervalMs));
      setRevealedCount(count);
      if (count < totalChars) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [totalChars, intervalMs]);

  const skip = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setRevealedCount(totalChars);
  }, [totalChars]);

  return [revealedCount, skip] as const;
}

/** Slices a flattened multi-line reveal count back into per-line visible text. */
export function revealLines(lines: readonly string[], revealedCount: number): string[] {
  let remaining = revealedCount;
  return lines.map((line) => {
    const take = Math.max(0, Math.min(line.length, remaining));
    remaining -= line.length;
    return line.slice(0, take);
  });
}

/** The line the reveal cursor currently sits at the end of. */
export function currentLineIndex(lines: readonly string[], revealedCount: number): number {
  let cumulative = 0;
  for (let i = 0; i < lines.length; i++) {
    cumulative += lines[i].length;
    if (revealedCount <= cumulative) return i;
  }
  return Math.max(0, lines.length - 1);
}
