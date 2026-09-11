import { useEffect, useState } from 'react';
import { useTerminal, useAct } from '../state/terminal';
import type { Verdict } from '../scoring/recognition';
import { deriveTechniques, type Suspicion, type Technique } from '../scoring/technique';
import type { CompositeConfig } from '../canvas/pipeline';
import type { Act } from '../state/act';
import type { SuspectId } from '../data/suspects';
import { VERDICT_MOTION } from './motion';

const TONE = {
  clean: 'text-phosphor',
  flagged: 'text-alert',
  identified: 'text-amber',
} as const;

/**
 * Written to read the same regardless of whose bulletin this is — the
 * dispatch desk has no idea the operator's own record just went through it.
 * No "you win" language anywhere: the tension comes from what the player
 * knows, not from the copy explaining it.
 */
const COPY: Record<Verdict['outcome'], { dispatch: string; caseNote: string; teletype: string }> = {
  clean: {
    dispatch: 'DISPATCH: Negative return on visual comparison. No further action requested.',
    caseNote: 'CASE NOTE — Composite inconclusive against booking photo on file. Held pending new intake.',
    teletype: 'TELETYPE 004 · WANTED DIV · NO ID CONFIRMED · FILE HELD',
  },
  identified: {
    dispatch: 'DISPATCH: Positive return. Units responding to last known position.',
    caseNote: 'CASE NOTE — Composite matches booking photo within tolerance. Forwarded to patrol.',
    teletype: 'TELETYPE 011 · WANTED DIV · POSITIVE ID · UNITS EN ROUTE',
  },
  flagged: {
    dispatch: "DISPATCH: Hold that bulletin. Compression artifacts don't match intake metadata.",
    caseNote: 'CASE NOTE — Image inconsistent with original intake scan. Referred for chain-of-custody review.',
    teletype: 'TELETYPE 019 · INTERNAL AFFAIRS · BULLETIN FLAGGED · REVIEW OPENED',
  },
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reyes only ever names a technique she's seen before -- the player has to
 * notice the count creeping up across cases and connect it to the
 * REVIEWING OFFICER field on their own. No tooltip explains this anywhere.
 */
const REYES_ADJECTIVE: Partial<Record<Technique, string>> = {
  grade: 'degraded',
  overlay: 'redacted',
};

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

function reyesNote(config: CompositeConfig, suspicion: Suspicion, act: Act): string | null {
  const named = deriveTechniques(config).filter((t): t is 'grade' | 'overlay' => t in REYES_ADJECTIVE);
  if (named.length === 0) return null;
  const worst = named.reduce((a, b) => (suspicion[b] > suspicion[a] ? b : a));
  const count = ordinal(suspicion[worst]);
  const adjective = REYES_ADJECTIVE[worst];
  // Act III: she's stopped explaining herself -- shorter every time, not just this one.
  return act === 'III' ? `REYES — ${count} ${adjective}. Noted.` : `REYES — ${count} ${adjective} bulletin this week.`;
}

export function VerdictView({ suspect, verdict }: { suspect: SuspectId; verdict: Verdict }) {
  const goQueue = useTerminal((s) => s.goQueue);
  const suspicion = useTerminal((s) => s.suspicion);
  // The bulletin issue() just prepended -- guaranteed present by the time this screen mounts.
  const issuedConfig = useTerminal((s) => s.bulletins[0]?.config);
  const act = useAct();
  const [filled, setFilled] = useState(prefersReducedMotion);
  const [revealed, setRevealed] = useState(prefersReducedMotion);

  // Bars start at 0 and animate to their measured value on mount; the
  // dispatch response waits for that fill (VERDICT_MOTION.barFillMs) before
  // it appears, so the verdict reads as a measurement completing rather
  // than a number and an explanation landing at once. Act III: dispatch
  // drags -- Internal Affairs slows everything down.
  const barFillMs = act === 'III' ? VERDICT_MOTION.barFillMsActIII : VERDICT_MOTION.barFillMs;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setFilled(true)));
    const timer = window.setTimeout(() => setRevealed(true), barFillMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [barFillMs]);

  const copy = COPY[verdict.outcome];
  const note = verdict.outcome === 'flagged' && issuedConfig ? reyesNote(issuedConfig, suspicion, act) : null;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div aria-live="polite" className="w-full max-w-md space-y-4 border border-phosphor-dim p-6 text-xs">
        <p tabIndex={-1} data-screen-heading className="text-phosphor-dim">
          DISPATCH RESPONSE — {suspect}
        </p>
        <Bar label="RECOGNITION" target={verdict.match} filled={filled} durationMs={barFillMs} />
        <Bar label="TAMPER" target={verdict.tamper} filled={filled} durationMs={barFillMs} />

        {revealed && (
          <div className="space-y-3 pt-2">
            <p className={`text-lg tracking-widest ${TONE[verdict.outcome]}`}>{verdict.outcome.toUpperCase()}</p>
            <p>{copy.dispatch}</p>
            <p className="text-phosphor-dim">{copy.caseNote}</p>
            <p className="text-phosphor-dim">{copy.teletype}</p>
            {note && <p className="text-alert">{note}</p>}
            <button
              onClick={goQueue}
              className="mt-2 w-full border border-phosphor px-4 py-2 tracking-widest
                         hover:bg-phosphor hover:text-terminal"
            >
              RETURN TO QUEUE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ label, target, filled, durationMs }: { label: string; target: number; filled: boolean; durationMs: number }) {
  return (
    <div>
      <p className="text-phosphor-dim">
        {label} {target}%
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={filled ? target : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full bg-panel"
      >
        <div
          className="h-full bg-phosphor transition-[width] ease-out"
          style={{ width: `${filled ? target : 0}%`, transitionDuration: `${durationMs}ms` }}
        />
      </div>
    </div>
  );
}
