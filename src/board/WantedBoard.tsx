import { useTerminal } from '../state/terminal';
import { SUSPECTS } from '../data/suspects';
import { BulletinThumb } from '../terminal/BulletinThumb';

export function WantedBoard() {
  const bulletins = useTerminal((s) => s.bulletins);

  if (bulletins.length === 0) {
    return (
      <p tabIndex={-1} data-screen-heading className="mt-24 text-center text-xs text-phosphor-dim">
        No bulletins issued. Compose one from the case queue.
      </p>
    );
  }

  return (
    <div className="grid h-full gap-6 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
      <h1 tabIndex={-1} data-screen-heading className="sr-only">
        Issued bulletins
      </h1>
      {bulletins.map((b) => (
        <BulletinThumb
          key={b.controlNumber}
          bulletin={b}
          caption={
            <>
              {b.suspect} · {SUSPECTS[b.suspect].name} · {b.controlNumber} · {new Date(b.issuedAt).toLocaleTimeString()}
            </>
          }
        />
      ))}
    </div>
  );
}
