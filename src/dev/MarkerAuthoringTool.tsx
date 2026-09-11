import { useRef, useState } from 'react';
import { MARKERS } from '../data/markers';
import { SUSPECTS, type SuspectId } from '../data/suspects';
import { formatMarkersEntry, type EditableMarker } from './formatMarkersEntry';

const SUSPECT_IDS = Object.keys(SUSPECTS) as SuspectId[];
const MIN_SIZE = 0.02;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Dev-only route: /#markers-tool with the dev server running. Not shipped —
 * see App.tsx, which strips this whole branch from production builds via
 * import.meta.env.DEV.
 *
 * Hand-guessing normalized rects and eyeballing whether the weights add up
 * is exactly the mistake the dev assertion in markers.ts exists to catch;
 * this tool exists so you rarely trip it in the first place.
 */
export function MarkerAuthoringTool() {
  const [suspectId, setSuspectId] = useState<SuspectId>(SUSPECT_IDS[0]);

  return (
    <div className="min-h-screen bg-terminal p-6 text-xs text-phosphor">
      <p className="mb-4 text-phosphor-dim">MARKER AUTHORING TOOL — dev only, not shipped</p>
      <label className="mb-4 block">
        <span className="text-phosphor-dim">SUSPECT </span>
        <select
          value={suspectId}
          onChange={(e) => setSuspectId(e.target.value as SuspectId)}
          className="border border-phosphor-dim bg-panel px-2 py-1"
        >
          {SUSPECT_IDS.map((id) => (
            <option key={id} value={id}>
              {id} — {SUSPECTS[id].name}
            </option>
          ))}
        </select>
      </label>
      {/* key resets all editor state on suspect switch instead of syncing it by hand */}
      <SuspectEditor key={suspectId} suspectId={suspectId} />
    </div>
  );
}

function SuspectEditor({ suspectId }: { suspectId: SuspectId }) {
  const [markers, setMarkers] = useState<EditableMarker[]>(() => MARKERS[suspectId].map((m) => ({ ...m })));
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const weightSum = markers.reduce((n, m) => n + m.weight, 0);
  const output = formatMarkersEntry(suspectId, markers);

  const update = (id: string, patch: Partial<EditableMarker>) => {
    setMarkers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addMarker = () => {
    const id = `${suspectId.toLowerCase()}-marker-${markers.length + 1}`;
    setMarkers((ms) => [...ms, { id, label: 'new marker', weight: 0, region: { x: 0.3, y: 0.3, w: 0.2, h: 0.15 } }]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <div ref={containerRef} className="relative inline-block w-[360px] border border-phosphor-dim">
        <img src={SUSPECTS[suspectId].portrait} alt="" className="block w-full" draggable={false} />
        {markers.map((m) => (
          <MarkerBox
            key={m.id}
            marker={m}
            containerRef={containerRef}
            onChange={(region) => update(m.id, { region })}
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <p className={weightSum === 100 ? 'text-phosphor' : 'text-alert'}>WEIGHT SUM: {weightSum} / 100</p>
          {markers.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 border border-phosphor-dim/40 p-2">
              <input
                value={m.id}
                onChange={(e) => update(m.id, { id: e.target.value })}
                className="w-36 border border-phosphor-dim bg-panel px-1"
                aria-label="marker id"
              />
              <input
                value={m.label}
                onChange={(e) => update(m.id, { label: e.target.value })}
                className="w-40 border border-phosphor-dim bg-panel px-1"
                aria-label="marker label"
              />
              <input
                type="number"
                value={m.weight}
                onChange={(e) => update(m.id, { weight: Number(e.target.value) })}
                className="w-16 border border-phosphor-dim bg-panel px-1"
                aria-label="marker weight"
              />
              <button
                onClick={() => setMarkers((ms) => ms.filter((x) => x.id !== m.id))}
                className="text-alert hover:underline"
              >
                delete
              </button>
            </div>
          ))}
          <button onClick={addMarker} className="border border-phosphor-dim px-2 py-1 hover:border-phosphor">
            + add marker
          </button>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-phosphor-dim">COPY-PASTEABLE TS</p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(output);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // Clipboard permission denied or unavailable — the textarea below is still selectable by hand.
                }
              }}
              className="border border-phosphor-dim px-2 py-0.5 hover:border-phosphor"
            >
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <textarea
            readOnly
            value={output}
            rows={markers.length + 2}
            className="w-full border border-phosphor-dim bg-panel p-2 font-mono text-[11px]"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Drag the body to move, drag the corner handle to resize. Same
 * pointer-capture technique as ComposerStage's OverlayHandle, extended with
 * a resize handle since a marker is a rect, not a point.
 */
function MarkerBox({
  marker,
  containerRef,
  onChange,
}: {
  marker: EditableMarker;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onChange: (region: EditableMarker['region']) => void;
}) {
  const { region } = marker;

  const startDrag = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = region;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === 'move') {
        const x = clamp01(Math.min(start.x + dx, 1 - start.w));
        const y = clamp01(Math.min(start.y + dy, 1 - start.h));
        onChange({ ...start, x: Math.max(0, x), y: Math.max(0, y) });
      } else {
        const w = Math.max(MIN_SIZE, Math.min(start.w + dx, 1 - start.x));
        const h = Math.max(MIN_SIZE, Math.min(start.h + dy, 1 - start.y));
        onChange({ ...start, w, h });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      onPointerDown={(e) => startDrag(e, 'move')}
      style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }}
      className="absolute cursor-grab touch-none border-2 border-dashed border-alert bg-alert/10 active:cursor-grabbing"
    >
      <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap bg-terminal px-0.5 text-[10px] text-alert">
        {marker.label}
      </span>
      <div
        onPointerDown={(e) => startDrag(e, 'resize')}
        className="absolute -right-1 -bottom-1 h-3 w-3 cursor-nwse-resize border border-alert bg-terminal"
      />
    </div>
  );
}
