import { createContext, useContext, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EditorPanel } from './EditorPanel';
import { composite, type CompositeConfig } from '../canvas/pipeline';
import { SUSPECTS, type SuspectId } from '../data/suspects';
import { generateControlNumber, type ControlNumber } from '../lib/brand';
import type { DispatchLocale } from '../lib/unlayer';

export interface ComposeSessionData {
  readonly image: string;
  readonly suspect: SuspectId;
  readonly config: CompositeConfig;
  readonly controlNumber: ControlNumber;
  readonly locale: DispatchLocale;
}

interface EditorSessionContextValue {
  readonly publish: (data: ComposeSessionData) => void;
  readonly setSlot: (node: HTMLDivElement | null) => void;
  readonly liveDelta: number;
}

const EditorSessionContext = createContext<EditorSessionContextValue | null>(null);

/**
 * Mounts the one `<EditorPanel>` (and the one `<ImageEditor>` inside it) for
 * the whole queue session, above the screen router -- see TerminalShell.
 * Navigating between CaseQueue/RecordView/ComposerStage never unmounts this;
 * only a fresh `publish()` (a new case's plate) makes it call the SDK's own
 * internal reset(), the same as any other `image` prop change (see the
 * unlayer-editor skill).
 *
 * Portals the editor's DOM into whichever slot the active ComposerStage
 * currently claims via `useComposeSession`, so it appears inline in that
 * screen's own grid layout without either component needing to know the
 * other's CSS. Falls back to a permanently-mounted, offscreen slot the rest
 * of the time so the SDK's mount point is never removed from the document.
 */
export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ComposeSessionData | null>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [liveDelta, setLiveDelta] = useState(0);
  const [fallback, setFallback] = useState<HTMLDivElement | null>(null);

  // setSession/setSlot are useState setters -- already stable, no need to wrap them.
  const value = useMemo<EditorSessionContextValue>(
    () => ({ publish: setSession, setSlot, liveDelta }),
    [setSlot, liveDelta],
  );

  const portalTarget = slot ?? fallback;

  return (
    <EditorSessionContext.Provider value={value}>
      {children}
      <div ref={setFallback} aria-hidden className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden" />
      {session &&
        portalTarget &&
        createPortal(
          <EditorPanel
            image={session.image}
            suspect={session.suspect}
            config={session.config}
            controlNumber={session.controlNumber}
            locale={session.locale}
            onLiveDeltaChange={setLiveDelta}
          />,
          portalTarget,
        )}
    </EditorSessionContext.Provider>
  );
}

/**
 * ComposerStage calls this with the rail's current choices; it composites the
 * plate, publishes it to the persistent editor, and claims the DOM slot the
 * editor should render into. Unmounting releases the slot (back to the
 * provider's offscreen fallback) but never clears the published session --
 * leaving compose must not tear the editor down, that's the entire point of
 * this module.
 *
 * The plate, the config it was rendered from, and the control number stamped
 * onto it are one record, set together when a composite finishes. What the
 * editor holds and what the issued bulletin claims (and is scored on) can't
 * disagree, even while the rail is ahead of an in-flight recomposite.
 * `plate` is the finished image for ComposerStage's own preview.
 */
export function useComposeSession({
  suspect,
  config,
  locale,
}: {
  suspect: SuspectId;
  config: CompositeConfig;
  locale: DispatchLocale;
}): { plate: string | null; error: string | null; slotRef: (node: HTMLDivElement | null) => void; liveDelta: number } {
  const ctx = useContext(EditorSessionContext);
  if (!ctx) throw new Error('useComposeSession must be used within an EditorSessionProvider');
  const { publish, setSlot, liveDelta } = ctx;

  // One control number per composition session -- stamped onto every plate
  // and carried onto the issued bulletin.
  const [controlNumber] = useState(() => generateControlNumber());
  const [plate, setPlate] = useState<Omit<ComposeSessionData, 'locale'> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Syncs the canvas plate to the config + suspect portrait. Deferred so fast
  // typing in the bounty line (a config change on every keystroke) keeps the
  // input itself responsive instead of queuing a full recomposite --
  // including a PNG re-encode -- per character.
  const deferredConfig = useDeferredValue(config);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const portraitUrl = SUSPECTS[deferredConfig.substitutedPortrait ?? suspect].portrait;
        const image = await composite(portraitUrl, suspect, deferredConfig, controlNumber);
        if (!cancelled) setPlate({ image, suspect, config: deferredConfig, controlNumber });
      } catch {
        if (!cancelled) setError('Portrait scan unavailable.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suspect, deferredConfig, controlNumber]);

  // Memoized so an unrelated re-render (toggling markers, say) doesn't
  // re-publish an identical session and cascade a render through the
  // provider and the persistent editor for nothing.
  const session = useMemo(() => (plate ? { ...plate, locale } : null), [plate, locale]);
  useEffect(() => {
    if (session) publish(session);
  }, [session, publish]);

  useEffect(() => () => setSlot(null), [setSlot]);

  return { plate: plate?.image ?? null, error, slotRef: setSlot, liveDelta };
}
