import { useTerminal } from '../state/terminal';
import { OPERATOR_RECORD_ID, SUSPECTS, type SuspectId } from '../data/suspects';

/**
 * The record simply closes. No score, no "was it worth it" -- the facts sit
 * on the page exactly like every other field in this terminal, and that's
 * the whole effect.
 */
export function EpilogueView({ framed }: { framed: SuspectId }) {
  const goQueue = useTerminal((s) => s.goQueue);
  const operator = useTerminal((s) => s.operator);
  const record = SUSPECTS[framed];
  const operatorCharge = SUSPECTS[OPERATOR_RECORD_ID].charge;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-md space-y-3 border border-phosphor-dim p-6 text-xs">
        <h1 tabIndex={-1} data-screen-heading className="text-lg tracking-widest text-amber">
          {record.name}
        </h1>
        <Field label="RECORD" value={framed} />
        <Field label="STATUS" value="ARRESTED" />
        <Field label="CHARGE" value={operatorCharge} />
        <Field label="CLOSED BY" value={operator ?? '—'} />

        <button
          onClick={goQueue}
          className="mt-2 w-full border border-phosphor px-4 py-2 tracking-widest
                     hover:bg-phosphor hover:text-terminal"
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-phosphor-dim">{label.padEnd(16, '.')}</span> {value}
    </p>
  );
}
