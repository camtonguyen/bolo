import { useEffect, useRef, useState } from 'react';
import { useTerminal, useAct } from '../state/terminal';
import { isSuspectId, OPERATOR_RECORD_ID, SUSPECTS, type SuspectId } from '../data/suspects';
import type { CompositeConfig, LookId, OverlayId } from '../canvas/pipeline';
import { STAMPS } from '../assets/stamps';
import { evaluate } from '../scoring/recognition';
import { readCoverage, type EditorReading } from '../scoring/markerCoverage';
import { useComposeSession } from './EditorSession';
import type { DispatchLocale } from '../lib/unlayer';

const LOOKS: readonly { id: LookId; label: string }[] = [
  { id: 'raw', label: 'RAW SCAN' },
  { id: 'archival', label: 'ARCHIVAL' },
  { id: 'degraded', label: 'DEGRADED' },
];

// Framed in-world as which regional precincts the bulletin broadcasts to --
// backs the editor's own `locale`, so the label doubles as the dispatch flavor text.
const DISPATCH_LANGUAGES: readonly { id: DispatchLocale; label: string }[] = [
  { id: 'en', label: 'LEONIDA CENTRAL' },
  { id: 'es', label: 'PORT VERONA SUR' },
  { id: 'fr', label: 'BAYOU PRECINCT' },
  { id: 'de', label: 'NORTH SHORE' },
];

const OVERLAYS: readonly { id: OverlayId; label: string }[] = [
  { id: 'redaction-bar', label: 'REDACTION BAR' },
  { id: 'seal', label: 'CASE SEAL' },
  { id: 'evidence-tag', label: 'EVIDENCE TAG' },
  { id: 'glare', label: 'GLASS GLARE' },
  { id: 'tampered', label: 'TAMPERED STAMP' },
];

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function ComposerStage({ suspect }: { suspect: SuspectId }) {
  const goQueue = useTerminal((s) => s.goQueue);
  const [config, setConfig] = useState<CompositeConfig>({
    version: 1,
    look: 'raw',
    overlays: [],
    bountyText: '',
    substitutedPortrait: null,
  });
  const [locale, setLocale] = useState<DispatchLocale>('en');
  const previewRef = useRef<HTMLDivElement>(null);
  // On for the player's first-ever case (no bulletin issued yet), off after -- by then they've seen the connection once.
  const [showMarkers, setShowMarkers] = useState(() => useTerminal.getState().bulletins.length === 0);

  // 'M' toggles the marker overlay -- ignored while typing in a text field (e.g. the bounty line).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setShowMarkers((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Composites the plate for this case and publishes it to the one persistent
  // editor instance (see EditorSession), claiming the DOM slot below for it to
  // render into. Leaving this screen releases the slot but never clears the
  // published session -- the editor keeps showing this case until a new one
  // publishes.
  const { plate, error, slotRef, reading, editorHasChanges } = useComposeSession({ suspect, config, locale });

  /**
   * Every rail control recomposites the plate, and a recomposite is a new
   * `image` prop, which the SDK silently resets the live editor to -- taking
   * any in-progress crop/text/draw work with it (see the unlayer-editor
   * skill). So the rail closes while the editor holds unsaved edits: transmit
   * them or abort, then the plate is editable again.
   *
   * Dispatch language stays open: it maps to the editor's own `locale`, which
   * updates in place and never touches the composited plate.
   */
  const locked = editorHasChanges;

  // Toggling adds a placement at the overlay's registry default, or removes
  // it if already on the plate.
  const toggleOverlay = (id: OverlayId) => {
    setConfig((c) => {
      if (c.overlays.some((o) => o.id === id)) {
        return { ...c, overlays: c.overlays.filter((o) => o.id !== id) };
      }
      return { ...c, overlays: [...c.overlays, { id, ...STAMPS[id].defaultPosition }] };
    });
  };

  const moveOverlay = (id: OverlayId, x: number, y: number) => {
    setConfig((c) => ({ ...c, overlays: c.overlays.map((o) => (o.id === id ? { ...o, x, y } : o)) }));
  };

  // The heading stays mounted in the same position across the
  // loading/error/loaded states -- it's the focus target set on screen
  // change, and swapping it out from under that focus would drop it back to
  // document.body once the loading placeholder it replaced unmounts.
  const containerClass =
    plate && !error ? 'grid h-full grid-rows-[auto_1fr] lg:grid-rows-1 lg:grid-cols-[220px_1fr]' : 'p-8';

  return (
    <div className={containerClass}>
      <h1 tabIndex={-1} data-screen-heading className="sr-only">
        Compose bulletin — {suspect}
      </h1>
      {error ? (
        <p className="text-xs text-alert">{error}</p>
      ) : !plate ? (
        <p className="text-xs text-phosphor-dim">Loading plate…</p>
      ) : (
        <>
          <aside className="space-y-4 overflow-y-auto border-phosphor-dim p-4 text-xs lg:border-r">
            <button onClick={goQueue} className="text-phosphor-dim hover:text-amber">
              ← CANCEL
            </button>

            {locked && <PlateLockNotice />}

            <div className="space-y-1">
              <p className="text-phosphor-dim">PLATE TREATMENT</p>
              {LOOKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setConfig((c) => ({ ...c, look: l.id }))}
                  disabled={locked}
                  aria-pressed={config.look === l.id}
                  className={`block w-full border px-2 py-1.5 text-left tracking-wider ${
                    config.look === l.id
                      ? 'border-amber text-amber'
                      : 'border-phosphor-dim/40 text-phosphor-dim enabled:hover:border-phosphor'
                  } ${locked ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-phosphor-dim">OVERLAYS</p>
              {OVERLAYS.map((o) => {
                const active = config.overlays.some((placed) => placed.id === o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleOverlay(o.id)}
                    disabled={locked}
                    aria-pressed={active}
                    className={`block w-full border px-2 py-1.5 text-left tracking-wider ${
                      active
                        ? 'border-alert text-alert'
                        : 'border-phosphor-dim/40 text-phosphor-dim enabled:hover:border-phosphor'
                    } ${locked ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            {/* Only the operator record can frame someone else. Presented flatly, no confirmation, no framing of its own. */}
            {suspect === OPERATOR_RECORD_ID && (
              <label className="block space-y-1">
                <span className="text-phosphor-dim">SOURCE PORTRAIT</span>
                <select
                  value={config.substitutedPortrait ?? ''}
                  disabled={locked}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      substitutedPortrait: isSuspectId(e.target.value) ? e.target.value : null,
                    }))
                  }
                  className={`w-full border border-phosphor-dim bg-transparent px-2 py-1.5 ${
                    locked ? 'cursor-not-allowed opacity-40' : ''
                  }`}
                >
                  <option value="">own record</option>
                  {(Object.keys(SUSPECTS) as SuspectId[])
                    .filter((id) => id !== suspect)
                    .map((id) => (
                      <option key={id} value={id}>
                        {id} — {SUSPECTS[id].name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            {/*
              Always shown, not just when overlays exist -- this is also where the marker
              overlay lives (Part 5.2). It has to be a preview we render ourselves: the
              mounted Unlayer editor exposes no way to read back its own zoom/pan state
              (see the unlayer-editor skill), so there's no reliable way to align an
              external overlay against its actual canvas without inventing API that
              doesn't exist. This <img> is plain markup we fully control instead.
            */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-phosphor-dim">PLATE PREVIEW</p>
                <button
                  onClick={() => setShowMarkers((v) => !v)}
                  aria-pressed={showMarkers}
                  className={`px-2 py-0.5 text-[10px] tracking-wider ${
                    showMarkers ? 'text-amber' : 'text-phosphor-dim hover:text-phosphor'
                  }`}
                >
                  MARKERS (M)
                </button>
              </div>
              {config.overlays.length > 0 && !locked && (
                <p className="text-[10px] text-phosphor-dim">Drag to reposition.</p>
              )}
              <div ref={previewRef} className="relative w-full touch-none select-none border border-phosphor-dim">
                <img src={plate.image} alt="" className="block w-full" draggable={false} />
                {/*
                  Read with the live forensic reading, not just the config, so a
                  marker the player blacks out with the SDK's own draw or crop
                  tools goes dashed here too. What reads as obscured on this
                  preview is exactly what evaluate() scored as obscured.
                */}
                {showMarkers &&
                  readCoverage(suspect, plate.config, reading).markers.map(({ marker, rect, obscured }) => (
                    <div
                      key={marker.id}
                      aria-hidden
                      className={`pointer-events-none absolute border-2 ${
                        obscured ? 'border-dashed border-phosphor-dim' : 'border-alert'
                      }`}
                      style={{
                        left: `${rect.x * 100}%`,
                        top: `${rect.y * 100}%`,
                        width: `${rect.w * 100}%`,
                        height: `${rect.h * 100}%`,
                      }}
                    />
                  ))}
                {!locked &&
                  config.overlays.map((o) => (
                    <OverlayHandle key={o.id} id={o.id} x={o.x} y={o.y} containerRef={previewRef} onDrop={moveOverlay} />
                  ))}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-phosphor-dim">BOUNTY LINE</span>
              <input
                value={config.bountyText}
                disabled={locked}
                onChange={(e) => setConfig((c) => ({ ...c, bountyText: e.target.value }))}
                placeholder="REWARD $45,000"
                className={`w-full border border-phosphor-dim bg-transparent px-2 py-1 ${
                  locked ? 'cursor-not-allowed opacity-40' : ''
                }`}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-phosphor-dim">DISPATCH LANGUAGE</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as DispatchLocale)}
                className="w-full border border-phosphor-dim bg-transparent px-2 py-1.5"
              >
                {DISPATCH_LANGUAGES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Terminal-styled readout, not a progress bar -- proof that the SDK's own crop/text/draw tools do something, updating live as the player uses them. */}
            <p className="font-mono text-[11px] tracking-wider text-phosphor-dim">
              ALTERATION: <span className="text-amber">{Math.round(reading.frame * 100)}%</span>
            </p>

            {import.meta.env.DEV && <DevScorePanel config={plate.config} suspect={suspect} reading={reading} />}
          </aside>

          {/*
            The editor gets the full remaining width — the whole reason for a
            terminal. This div doesn't render the editor itself: the actual
            `<EditorPanel>` is one persistent instance owned by
            EditorSessionProvider (see EditorSession.tsx) that portals its
            DOM in here. `contents` drops this div out of the box tree so the
            portaled content becomes the real grid item in its place.
          */}
          <div ref={slotRef} className="contents" />
        </>
      )}
    </div>
  );
}

/**
 * Why the rail just went dim. In-world it reads as the terminal protecting a
 * plate that's already on the working surface; out of world it's the one
 * thing keeping a stray keystroke in the bounty line from wiping a careful
 * redaction.
 */
function PlateLockNotice() {
  return (
    <p
      aria-live="polite"
      className="border border-amber/60 bg-amber/10 px-2 py-1.5 text-[10px] leading-relaxed tracking-wider text-amber"
    >
      PLATE LOCKED — EDITS PENDING ON THE WORKING COPY. TRANSMIT OR ABORT TO ALTER THE PLATE.
    </p>
  );
}

/**
 * A drag handle over the mini plate preview. Tracks its own position while
 * dragging (immediate visual feedback) and only commits to config -- which
 * triggers a real recomposite -- on release, so a fast drag gesture doesn't
 * queue up dozens of composite() calls.
 */
function OverlayHandle({
  id,
  x,
  y,
  containerRef,
  onDrop,
}: {
  id: OverlayId;
  x: number;
  y: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDrop: (id: OverlayId, x: number, y: number) => void;
}) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const pos = dragPos ?? { x, y };

  const trackFromEvent = (e: React.PointerEvent): { x: number; y: number } | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) };
  };

  return (
    <div
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragPos({ x, y });
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        const next = trackFromEvent(e);
        if (next) setDragPos(next);
      }}
      onPointerUp={(e) => {
        const next = trackFromEvent(e);
        onDrop(id, next?.x ?? x, next?.y ?? y);
        setDragPos(null);
      }}
      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
      className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none
                 rounded-full border-2 border-alert bg-alert/50 active:cursor-grabbing"
      aria-hidden="true"
    />
  );
}

/**
 * Weight-tuning aid, not player-facing UI — stripped from production builds
 * by `import.meta.env.DEV`. evaluate() is pure arithmetic on `config`, so
 * this just reads the live outcome as you tweak controls, no extra state.
 */
function DevScorePanel({
  config,
  suspect,
  reading,
}: {
  config: CompositeConfig;
  suspect: SuspectId;
  reading: EditorReading;
}) {
  // Read here, not in ComposerStage: production builds never render this, so they shouldn't subscribe either.
  const suspicion = useTerminal((s) => s.suspicion);
  const act = useAct();
  const v = evaluate(config, suspect, suspicion, act, reading);
  const tone =
    v.outcome === 'clean' ? 'text-phosphor' : v.outcome === 'flagged' ? 'text-alert' : 'text-amber';
  return (
    <div className="space-y-1 border border-dashed border-phosphor-dim/50 p-2 text-[11px]">
      <p className="text-phosphor-dim">DEV SCORE (not shown to players)</p>
      <p>
        match {v.match} · tamper {v.tamper} · <span className={tone}>{v.outcome}</span>
      </p>
    </div>
  );
}
