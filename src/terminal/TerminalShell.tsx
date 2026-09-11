import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { useTerminal, HEAT_DECAY_INTERVAL_MS, type Screen } from '../state/terminal';
import { StatusStrip } from './StatusStrip';
import { BootSequence } from './BootSequence';
import { LoginScreen } from './LoginScreen';
import { CaseQueue } from './CaseQueue';
import { RecordView } from './RecordView';
import { VerdictView } from './VerdictView';
import { EpilogueView } from './EpilogueView';
import { EndingView } from './EndingView';
import { ComposerStage } from '../composer/ComposerStage';
import { EditorSessionProvider } from '../composer/EditorSession';
import { WantedBoard } from '../board/WantedBoard';
import { DispatchPrompt } from './DispatchPrompt';
import { CRT_MOTION, nextFlickerDelayMs } from './motion';
import { primeAudio, setMuted } from '../audio/sound';

const CRT_STYLE = {
  '--crt-bloom-near': `${CRT_MOTION.bloom.nearBlurPx}px`,
  '--crt-bloom-near-op': CRT_MOTION.bloom.nearOpacity,
  '--crt-bloom-far': `${CRT_MOTION.bloom.farBlurPx}px`,
  '--crt-bloom-far-op': CRT_MOTION.bloom.farOpacity,
  '--crt-barrel-inner': `${CRT_MOTION.barrel.innerStopPct}%`,
  '--crt-barrel-darken': CRT_MOTION.barrel.darkenOpacity,
  '--crt-fringe-offset': `${CRT_MOTION.fringe.offsetPx}px`,
  '--crt-fringe-ring': `${CRT_MOTION.fringe.ringStopPct}%`,
  '--crt-fringe-op': CRT_MOTION.fringe.ringOpacity,
} as CSSProperties;

/** One rAF-bounded frame of dimmed brightness per tick — real motion, so it stays off under reduced-motion. */
function useCrtFlicker(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timeoutId: number;
    const tick = () => {
      timeoutId = window.setTimeout(() => {
        const el = rootRef.current;
        if (el) {
          el.style.filter = `brightness(${1 - CRT_MOTION.flicker.brightnessDelta})`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.filter = '';
            });
          });
        }
        tick();
      }, nextFlickerDelayMs());
    };
    tick();
    return () => window.clearTimeout(timeoutId);
  }, [rootRef]);
}

/** Distinguishes 'record'/'compose'/'verdict' screens holding different suspects -- not just the screen kind. */
function screenKey(screen: Screen): string {
  return 'suspect' in screen ? `${screen.kind}:${screen.suspect}` : screen.kind;
}

/**
 * Moves focus to the new screen's heading on every screen change, so a
 * keyboard/screen-reader user is never left on a button that just unmounted.
 * Each screen component marks its own heading (or, while loading/erroring,
 * whatever it renders instead) with `data-screen-heading` + `tabIndex={-1}`.
 */
function useScreenFocus(screen: Screen) {
  const key = screenKey(screen);
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-screen-heading]')?.focus();
  }, [key]);
}

/**
 * Cools heat toward zero on a fixed wall-clock tick — syncs to real elapsed
 * session time, not casesClosed or any player action, so suspicion fades
 * even while the player is just reading a record or sitting on the queue.
 */
function useHeatDecay() {
  const decayHeat = useTerminal((s) => s.decayHeat);
  useEffect(() => {
    const id = window.setInterval(decayHeat, HEAT_DECAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [decayHeat]);
}

/** Autoplay policy throws on a bare `new AudioContext()` -- wait for the first real user gesture, then never again. */
function usePrimeAudioOnGesture() {
  useEffect(() => {
    const prime = () => {
      primeAudio(useTerminal.getState().muted);
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
    window.addEventListener('pointerdown', prime);
    window.addEventListener('keydown', prime);
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);
}

export function TerminalShell() {
  const screen = useTerminal((s) => s.screen);
  const muted = useTerminal((s) => s.muted);
  const rootRef = useRef<HTMLDivElement>(null);
  useCrtFlicker(rootRef);
  useHeatDecay();
  useScreenFocus(screen);
  usePrimeAudioOnGesture();
  useEffect(() => setMuted(muted), [muted]);

  return (
    <EditorSessionProvider>
      <div ref={rootRef} className="relative flex h-full w-full flex-col bg-terminal" style={CRT_STYLE}>
        {/* CRT scanlines + vignette. Part of the in-world look. */}
        <div aria-hidden className="scanlines pointer-events-none fixed inset-0 z-50 opacity-[0.12]" />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40"
          style={{ background: 'radial-gradient(120% 90% at 50% 50%, transparent 55%, #000 100%)' }}
        />
        {/* Barrel curvature + chromatic fringe. CSS-only, static — no per-frame paint cost. */}
        <div aria-hidden className="crt-edge pointer-events-none fixed inset-0 z-45" />

        {screen.kind !== 'boot' && <StatusStrip />}

        {/* min-h-0 overrides the flex default of min-height:auto -- without it, a flex-1 child grows to fit tall content (like RecordView's new columns) instead of being capped to the remaining viewport height, and the child's own overflow-y-auto never engages. */}
        <main className="relative z-10 min-h-0 flex-1 overflow-hidden">
          <ScreenRouter />
        </main>

        <DispatchPrompt />
      </div>
    </EditorSessionProvider>
  );
}

function ScreenRouter() {
  const screen = useTerminal((s) => s.screen);

  switch (screen.kind) {
    case 'boot':
      return <BootSequence />;
    case 'login':
      return <LoginScreen />;
    case 'queue':
      return <CaseQueue />;
    case 'record':
      return <RecordView suspect={screen.suspect} />;
    case 'compose':
      return <ComposerStage suspect={screen.suspect} />;
    case 'verdict':
      return <VerdictView suspect={screen.suspect} verdict={screen.verdict} />;
    case 'board':
      return <WantedBoard />;
    case 'epilogue':
      return <EpilogueView framed={screen.framed} />;
    case 'ending':
      return <EndingView ending={screen.ending} />;
    default: {
      // Exhaustiveness: adding a Screen variant without handling it fails the build.
      const never: never = screen;
      throw new Error(`Unhandled screen: ${JSON.stringify(never)}`);
    }
  }
}
