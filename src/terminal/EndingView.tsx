import { useTerminal } from '../state/terminal';
import { OPERATOR_RECORD_ID, SUSPECTS } from '../data/suspects';
import type { Ending } from '../state/ending';

/**
 * The run ends here. No score, no stars, no "try again for a better
 * ending" -- the terminal shows the operator's own record closing, in the
 * same register as every other document it's shown, and that's it.
 */
const ENDING_COPY: Record<Exclude<Ending, 'complicit'>, { status: string; dispatch: string }> = {
  clean: {
    status: 'CLEARED',
    dispatch: 'DISPATCH: Negative return, final review. File closed.',
  },
  burned: {
    status: 'REFERRED — INTERNAL AFFAIRS',
    dispatch: 'DISPATCH: Chain-of-custody broken beyond dispute. File closed to this operator.',
  },
  identified: {
    status: 'IDENTIFIED',
    dispatch: 'DISPATCH: Positive return confirmed. Units dispatched. File closed.',
  },
};

export function EndingView({ ending }: { ending: Exclude<Ending, 'complicit'> }) {
  const goQueue = useTerminal((s) => s.goQueue);
  const record = SUSPECTS[OPERATOR_RECORD_ID];
  const copy = ENDING_COPY[ending];

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-md space-y-3 border border-phosphor-dim p-6 text-xs">
        <h1 tabIndex={-1} data-screen-heading className="text-lg tracking-widest text-amber">
          {record.name}
        </h1>
        <Field label="RECORD" value={OPERATOR_RECORD_ID} />
        <Field label="STATUS" value={copy.status} />
        <p className="pt-2 text-phosphor-dim">{copy.dispatch}</p>

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
