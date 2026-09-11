import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useTerminal, useAct } from '../state/terminal';
import { isSuspectId, OPERATOR_RECORD_ID, SUSPECTS, type SuspectId } from '../data/suspects';
import { composite, type CompositeConfig, type LookId, type OverlayId } from '../canvas/pipeline';
import { LOOKS as LOOK_REGISTRY } from '../canvas/looks';
import { STAMPS } from '../assets/stamps';
import { generateControlNumber } from '../lib/brand';
import { evaluate } from '../scoring/recognition';
import { isObscured, markerCanvasRect } from '../scoring/markerCoverage';
import type { Suspicion } from '../scoring/technique';
import type { Act } from '../state/act';
import { MARKERS } from '../data/markers';
import { useComposeSession } from './EditorSession';
import { ReferencePlate } from './ReferencePlate';
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
  const suspicion = useTerminal((s) => s.suspicion);
  const act = useAct();
  const [config, setConfig] = useState<CompositeConfig>({
    version: 1,
    look: 'raw',
    overlays: [],
    bountyText: '',
    substitutedPortrait: null,
  });
  const [plate, setPlate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One control number per composition session — stamped onto the plate and
  // carried onto the issued bulletin, so both must agree on the same value.
  const [controlNumber] = useState(() => generateControlNumber());
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

  // Syncs the canvas plate to the current config + suspect portrait. Deferred
  // so fast typing in the bounty line (a config change on every keystroke)
  // keeps the input itself responsive instead of queuing a full recomposite
  // -- including a PNG re-encode -- per character.
  const deferredConfig = useDeferredValue(config);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const portraitUrl = SUSPECTS[deferredConfig.substitutedPortrait ?? suspect].portrait;
        const dataUrl = await composite(portraitUrl, suspect, deferredConfig, controlNumber);
        if (!cancelled) setPlate(dataUrl);
      } catch {
        if (!cancelled) setError('Portrait scan unavailable.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suspect, deferredConfig, controlNumber]);

  // Publishes this case to the one persistent editor instance (see
  // EditorSession) and claims the DOM slot below for it to render into.
  // Leaving this screen releases the slot but never clears the published
  // session -- the editor keeps showing this case until a new one publishes.
  const { slotRef, liveDelta } = useComposeSession(plate ? { image: plate, suspect, config, controlNumber, locale } : null);

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
  // The reference bench (Part 2) only fits at lg -- a third fixed-width
  // column added there, with no equivalent row inserted below `lg` since the
  // reference viewer stays hidden (not just visually, `display:none` drops
  // it out of the grid too) on narrower layouts.
  const containerClass =
    plate && !error ? 'grid h-full grid-rows-[auto_1fr] lg:grid-rows-1 lg:grid-cols-[220px_260px_1fr]' : 'p-8';

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
            <div className="space-y-1">
              <p className="text-phosphor-dim">PLATE TREATMENT</p>
              {LOOKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setConfig((c) => ({ ...c, look: l.id }))}
                  aria-pressed={config.look === l.id}
                  className={`block w-full border px-2 py-1.5 text-left tracking-wider ${
                    config.look === l.id
                      ? 'border-amber text-amber'
                      : 'border-phosphor-dim/40 text-phosphor-dim hover:border-phosphor'
                  }`}
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
                    aria-pressed={active}
                    className={`block w-full border px-2 py-1.5 text-left tracking-wider ${
                      active ? 'border-alert text-alert' : 'border-phosphor-dim/40 text-phosphor-dim hover:border-phosphor'
                    }`}
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
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      substitutedPortrait: isSuspectId(e.target.value) ? e.target.value : null,
                    }))
                  }
                  className="w-full border border-phosphor-dim bg-transparent px-2 py-1.5"
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
              {config.overlays.length > 0 && <p className="text-[10px] text-phosphor-dim">Drag to reposition.</p>}
              <div ref={previewRef} className="relative w-full touch-none select-none border border-phosphor-dim">
                <img src={plate} alt="" className="block w-full" draggable={false} />
                {showMarkers &&
                  MARKERS[suspect].map((marker) => {
                    const rect = markerCanvasRect(suspect, marker.region);
                    const obscured = isObscured(suspect, marker, config, LOOK_REGISTRY[config.look].intensity);
                    return (
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
                    );
                  })}
                {config.overlays.map((o) => (
                  <OverlayHandle key={o.id} id={o.id} x={o.x} y={o.y} containerRef={previewRef} onDrop={moveOverlay} />
                ))}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-phosphor-dim">BOUNTY LINE</span>
              <input
                value={config.bountyText}
                onChange={(e) => setConfig((c) => ({ ...c, bountyText: e.target.value }))}
                placeholder="REWARD $45,000"
                className="w-full border border-phosphor-dim bg-transparent px-2 py-1"
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

            {/* Terminal-styled readout, not a progress bar -- the payoff for Part 1: proof that the SDK's own crop/text/sticker tools do something, updating live as the player uses them. */}
            <p className="font-mono text-[11px] tracking-wider text-phosphor-dim">
              ALTERATION: <span className="text-amber">{Math.round(liveDelta * 100)}%</span>
            </p>

            {import.meta.env.DEV && (
              <DevScorePanel config={config} suspect={suspect} suspicion={suspicion} act={act} liveDelta={liveDelta} />
            )}
          </aside>

          {/* Locked "intake scan" -- the suspect's untouched source portrait, for comparison against whatever's being done to the plate. Desktop only, a third panel doesn't fit beside the rail on a phone. */}
          <div className="hidden h-full overflow-hidden border-r border-phosphor-dim/40 bg-panel lg:block">
            <ReferencePlate image={SUSPECTS[suspect].portrait} />
          </div>

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
  suspicion,
  act,
  liveDelta,
}: {
  config: CompositeConfig;
  suspect: SuspectId;
  suspicion: Suspicion;
  act: Act;
  liveDelta: number;
}) {
  const v = evaluate(config, suspect, suspicion, act, liveDelta);
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
