import { useTerminal, useAct } from '../state/terminal';

/** Strip reads warm before Internal Affairs is formally involved. */
const HEAT_WARN_THRESHOLD = 50;
/** At or above this, Internal Affairs is actively watching — the banner stays up until heat decays back under it. */
const HEAT_CRITICAL_THRESHOLD = 80;

export function StatusStrip() {
  const { operator, casesClosed, heat, muted, goQueue, goBoard, toggleMuted } = useTerminal();
  const act = useAct();
  const heatTone =
    heat >= HEAT_CRITICAL_THRESHOLD ? 'text-alert' : heat >= HEAT_WARN_THRESHOLD ? 'text-amber' : '';

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-phosphor-dim px-4 py-2 text-[11px] tracking-widest">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button onClick={goQueue} className="whitespace-nowrap hover:text-amber">QUEUE</button>
          <button onClick={goBoard} className="whitespace-nowrap hover:text-amber">BOARD</button>
          <button onClick={toggleMuted} aria-pressed={!muted} className="whitespace-nowrap text-phosphor-dim hover:text-amber">
            SND {muted ? 'OFF' : 'ON'}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-phosphor-dim">
          <span className="whitespace-nowrap">OP {operator ?? '—'}</span>
          <span className="whitespace-nowrap">CLOSED {casesClosed}</span>
          <span className={`whitespace-nowrap ${heatTone}`}>HEAT {heat}</span>
          {/* Standing, not heat-triggered like the banner below -- a permanent mark once Act III begins, whatever heat happens to read right now. */}
          {act === 'III' && <span className="whitespace-nowrap text-alert">IA</span>}
        </div>
      </header>
      {heat >= HEAT_CRITICAL_THRESHOLD && (
        <div
          role="alert"
          className="border-b border-alert bg-alert/10 px-4 py-1 text-center text-[10px] tracking-widest text-alert"
        >
          INTERNAL AFFAIRS — ACTIVE MONITORING
        </div>
      )}
    </>
  );
}
