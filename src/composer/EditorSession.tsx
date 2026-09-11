import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EditorPanel } from './EditorPanel';
import type { CompositeConfig } from '../canvas/pipeline';
import type { SuspectId } from '../data/suspects';
import type { ControlNumber } from '../lib/brand';
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
 * ComposerStage calls this to publish the active case's plate/config to the
 * persistent editor and to claim the DOM slot it should render into.
 * Unmounting releases the slot (back to the provider's offscreen fallback)
 * but never clears the published session -- leaving compose must not tear
 * the editor down, that's the entire point of this module.
 */
export function useComposeSession(data: ComposeSessionData | null): { slotRef: (node: HTMLDivElement | null) => void; liveDelta: number } {
  const ctx = useContext(EditorSessionContext);
  if (!ctx) throw new Error('useComposeSession must be used within an EditorSessionProvider');
  const { publish, setSlot, liveDelta } = ctx;

  useEffect(() => {
    if (data) publish(data);
  }, [data, publish]);

  useEffect(() => () => setSlot(null), [setSlot]);

  return { slotRef: setSlot, liveDelta };
}
