import { useState } from 'react';
import { useTerminal } from '../state/terminal';
import { JURISDICTION, OPERATOR_RECORD_ID, SUSPECTS, type SuspectId } from '../data/suspects';
import { MARKERS, type Marker } from '../data/markers';
import { BulletinThumb } from './BulletinThumb';

/** Ambient background chatter -- static on purpose, not tied to any real event. It exists so the terminal reads as inhabited, not as a log of anything. */
const DISPATCH_LOG = [
  'TELETYPE 002 · WANTED DIV · ROUTINE PATROL · NO ACTION',
  'TELETYPE 003 · WANTED DIV · RECORDS SYNC · COMPLETE',
  'TELETYPE 004 · WANTED DIV · SHIFT CHANGE · 0600',
] as const;

export function RecordView({ suspect }: { suspect: SuspectId }) {
  const compose = useTerminal((s) => s.compose);
  const goQueue = useTerminal((s) => s.goQueue);
  const operator = useTerminal((s) => s.operator);
  const ending = useTerminal((s) => s.ending);
  const bulletins = useTerminal((s) => s.bulletins);
  const record = SUSPECTS[suspect];
  const isOperator = suspect === OPERATOR_RECORD_ID;
  const runEnded = isOperator && ending !== null;
  const markers = MARKERS[suspect];
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const activeMarker = markers.find((m) => m.id === activeMarkerId) ?? null;
  const priorBulletins = bulletins.filter((b) => b.suspect === suspect);

  return (
    <div className="grid h-full gap-6 overflow-y-auto p-6 lg:grid-cols-[280px_440px_1fr]">
      <div className="relative mx-auto w-full max-w-xs self-start border border-phosphor-dim bg-panel lg:mx-0 lg:max-w-none">
        <img
          src={record.portrait}
          alt={`Portrait of ${record.name}`}
          className="block w-full grayscale"
          // Below `lg` this grid item is its own row, stacked above the field/notes rows -- without an
          // explicit ratio, CSS Grid's auto row-sizing can't resolve a percentage-width image's height
          // (it depends on the column width, which depends on the row set, which depends on the image),
          // and collapses the row to ~0 while the image still paints outside it, overlapping what follows.
          style={{ aspectRatio: `${record.portraitSize.w} / ${record.portraitSize.h}` }}
        />
        <div aria-hidden className="scanlines pointer-events-none absolute inset-0 opacity-[0.18]" />
        <RegistrationMarks />
        {activeMarker && (
          <div
            aria-hidden
            className="pointer-events-none absolute border-2 border-phosphor"
            style={{
              left: `${activeMarker.region.x * 100}%`,
              top: `${activeMarker.region.y * 100}%`,
              width: `${activeMarker.region.w * 100}%`,
              height: `${activeMarker.region.h * 100}%`,
            }}
          />
        )}
      </div>

      <div className="space-y-3 text-xs">
        <button onClick={goQueue} className="text-phosphor-dim hover:text-amber">
          ← BACK TO QUEUE
        </button>
        <h1 tabIndex={-1} data-screen-heading className="text-lg tracking-widest text-amber">
          {record.name}
        </h1>
        <Field label="RECORD" value={suspect} />
        <Field label="ALIAS" value={record.alias} />
        <Field label="CHARGE" value={record.charge} />
        <Field label="LAST SEEN" value={record.lastSeen} />
        <Field label="BOUNTY" value={`$${record.bounty.toLocaleString()}`} />

        <div className="border-t border-phosphor-dim/30 pt-3">
          <p className="mb-2 text-[10px] tracking-widest text-phosphor-dim">RECORD METADATA</p>
          <Field label="INTAKE DATE" value={record.intakeDate} />
          <Field label="JURISDICTION" value={JURISDICTION} />
          <Field label="CASE OFFICER" value={operator ?? '—'} />
          <Field label="REVIEWING OFFICER" value="D. REYES" />
        </div>

        {runEnded ? (
          <p className="mt-6 text-phosphor-dim">CASE CLOSED</p>
        ) : (
          <button
            onClick={() => compose(suspect)}
            className="mt-6 border border-phosphor px-6 py-3 tracking-widest
                       hover:bg-phosphor hover:text-terminal"
          >
            {isOperator ? 'ALTER BULLETIN' : 'COMPOSE BULLETIN'}
          </button>
        )}
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <p className="mb-2 text-[10px] tracking-widest text-phosphor-dim">MATCH VECTORS</p>
          {markers.map((m) => (
            <MarkerRow
              key={m.id}
              marker={m}
              onActivate={() => setActiveMarkerId(m.id)}
              onDeactivate={() => setActiveMarkerId((id) => (id === m.id ? null : id))}
            />
          ))}
        </div>

        <div className="border-t border-phosphor-dim/30 pt-3">
          <p className="mb-2 text-[10px] tracking-widest text-phosphor-dim">CASE NOTES</p>
          <p className="text-phosphor-dim">
            No supplemental statements on file. Last confirmed sighting: {record.lastSeen}. Composite requested per
            standing bulletin policy.
          </p>
        </div>

        <div className="border-t border-phosphor-dim/30 pt-3">
          <p className="mb-2 text-[10px] tracking-widest text-phosphor-dim">BULLETIN HISTORY</p>
          {priorBulletins.length === 0 ? (
            <p className="text-phosphor-dim">No bulletins issued for this record.</p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
              {priorBulletins.map((b) => (
                <BulletinThumb key={b.controlNumber} bulletin={b} caption={b.controlNumber} dense />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-phosphor-dim/30 pt-3">
          <p className="mb-2 text-[10px] tracking-widest text-phosphor-dim">DISPATCH LOG</p>
          {DISPATCH_LOG.map((line) => (
            <p key={line} className="text-phosphor-dim">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const DOT_TARGET = 24;
const BAR_MAX = 10;

/**
 * Hover or focus outlines the marker's region on the portrait — the
 * connection that teaches the coverage mechanic without a tutorial. A
 * <button> gets keyboard focusability and the focus outline for free.
 */
function MarkerRow({ marker, onActivate, onDeactivate }: { marker: Marker; onActivate: () => void; onDeactivate: () => void }) {
  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className="flex w-full items-center gap-2 py-0.5 text-left hover:text-amber focus-visible:text-amber"
    >
      <span className="text-phosphor-dim">{marker.label.padEnd(DOT_TARGET, '.')}</span>
      <span className="w-9 text-right">{marker.weight}%</span>
      <span aria-hidden className="text-phosphor-dim">
        {'█'.repeat(Math.round((marker.weight / 100) * BAR_MAX))}
      </span>
    </button>
  );
}

/** Corner brackets, like a mugshot or evidence photo framed for alignment. */
function RegistrationMarks() {
  const corners = [
    'left-1 top-1 border-l border-t',
    'right-1 top-1 border-r border-t',
    'bottom-1 left-1 border-b border-l',
    'bottom-1 right-1 border-b border-r',
  ];
  return (
    <>
      {corners.map((corner) => (
        <span key={corner} aria-hidden className={`pointer-events-none absolute h-3.5 w-3.5 border-phosphor ${corner}`} />
      ))}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-phosphor-dim">{label.padEnd(20, '.')}</span> {value}
    </p>
  );
}
