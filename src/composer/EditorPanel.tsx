import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageEditor from '@unlayer/react-image-editor';
import { useTerminal } from '../state/terminal';
import { createEditorWatch, WATCH_INTERVAL_MS } from './editorWatch';
import { markerRects, NO_EDITOR_EDITS, type EditorReading } from '../scoring/markerCoverage';
import type { CompositeConfig } from '../canvas/pipeline';
import type { SuspectId } from '../data/suspects';
import type { DispatchLocale, EditorOptions, ImageEditorRef, SaveResult } from '../lib/unlayer';
import type { ControlNumber } from '../lib/brand';

interface Props {
  image: string;
  suspect: SuspectId;
  config: CompositeConfig;
  controlNumber: ControlNumber;
  locale: DispatchLocale;
  /** Lifts the live forensic-diff reading up for ComposerStage's readout and marker overlay -- display only, EditorPanel keeps its own copy for scoring. */
  onReadingChange?: (reading: EditorReading) => void;
  /**
   * Lifts hasChanges() up so ComposerStage can lock the rail while there are
   * unsaved in-editor edits. Any rail change recomposites the plate, which
   * the SDK takes as a new `image` and internally resets to -- silently
   * discarding whatever crop/text/draw work is in progress (see the
   * unlayer-editor skill). The lock is the only thing standing between the
   * player and that loss.
   */
  onHasChangesChange?: (hasChanges: boolean) => void;
}

/** Matches Tailwind's default `lg` breakpoint -- the point where the controls rail moves beside the editor instead of above it. */
const LG_QUERY = '(min-width: 1024px)';
/**
 * Below `lg` the rail and editor share one fixed-height column, so a 560px
 * floor here would starve the rail down to a sliver on a phone. minHeight is
 * a plain top-level prop (not part of `options`), so unlike the remount trap
 * this is safe to change on the fly.
 */
const EDITOR_MIN_HEIGHT = { mobile: 380, desktop: 560 };

function useEditorMinHeight(): number {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(LG_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop ? EDITOR_MIN_HEIGHT.desktop : EDITOR_MIN_HEIGHT.mobile;
}

/**
 * The two toolbar strings the terminal renames, in each precinct's own
 * language. Only our overrides need translating -- the SDK ships its own
 * strings for the rest of its UI, and stocking only `en` meant the three
 * other precincts fell back to a stock "Save"/"Cancel" mid-bulletin.
 *
 * `translations` is one of the three keys that apply in place, so this never
 * costs a remount however often the dispatch language changes.
 */
const TOOLBAR_TRANSLATIONS = {
  en: { 'image_editor.toolbar.save': 'Issue bulletin', 'image_editor.toolbar.cancel': 'Abort' },
  es: { 'image_editor.toolbar.save': 'Emitir boletín', 'image_editor.toolbar.cancel': 'Anular' },
  fr: { 'image_editor.toolbar.save': 'Émettre le bulletin', 'image_editor.toolbar.cancel': 'Annuler' },
  de: { 'image_editor.toolbar.save': 'Fahndung ausgeben', 'image_editor.toolbar.cancel': 'Abbrechen' },
} as const satisfies Record<DispatchLocale, Record<string, string>>;

/**
 * Verified API only — see .claude/skills/unlayer-editor/SKILL.md.
 * Props: image, options, editorId, minHeight, style, onLoad, onSave,
 * onCancel, onLoadError, onError.
 */
export function EditorPanel({
  image,
  suspect,
  config,
  controlNumber,
  locale,
  onReadingChange,
  onHasChangesChange,
}: Props) {
  const ref = useRef<ImageEditorRef>(null);
  const issue = useTerminal((s) => s.issue);
  const goQueue = useTerminal((s) => s.goQueue);
  const requestPrompt = useTerminal((s) => s.requestPrompt);
  const minHeight = useEditorMinHeight();

  const readingRef = useRef<EditorReading>(NO_EDITOR_EDITS);

  // The onX callbacks are always EditorSessionProvider's useState setters in
  // practice, which React guarantees are stable -- so they're safe to close
  // over directly and list as dependencies below, no ref-mirroring needed.
  const reportReading = useCallback(
    (reading: EditorReading) => {
      readingRef.current = reading;
      onReadingChange?.(reading);
    },
    [onReadingChange],
  );

  const [hasChanges, setHasChanges] = useState(false);
  const reportHasChanges = useCallback(
    (changed: boolean) => {
      setHasChanges(changed);
      onHasChangesChange?.(changed);
    },
    [onHasChangesChange],
  );

  // useState, not useMemo: the watch holds a baseline and in-flight state, so
  // it must never be silently recreated.
  const [watch] = useState(() => createEditorWatch({ onHasChanges: reportHasChanges, onDelta: reportReading }));

  // Which regions the poll measures -- this suspect's own markers. Memoized
  // so it doesn't re-baseline the watch on every unrelated render.
  const regions = useMemo(() => markerRects(suspect), [suspect]);

  // Re-baselines whenever `image` changes -- a rail edit (bounty line,
  // overlay toggle) recomposites the plate, which react-image-editor picks up
  // as a new `image` prop and resets itself to internally (see the
  // unlayer-editor skill), so the reading must always measure divergence from
  // whatever the editor is currently showing.
  useEffect(() => {
    watch.reset(image, regions);
  }, [image, regions, watch]);

  // hasChanges() drives the external TRANSMIT control every tick; the rest of
  // the loop's rules (cadence, skipping a busy decode) live in editorWatch.ts.
  useEffect(() => {
    const id = setInterval(() => watch.tick(ref.current?.editor ?? undefined), WATCH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [watch]);

  // Shared by both save paths -- the editor's own internal save button (via
  // onSave) and the external TRANSMIT control (via getImage()) -- so they
  // always produce an identical Bulletin.
  const handleSave = (dataUrl: string) => {
    issue({ suspect, controlNumber, posterDataUrl: dataUrl, config, issuedAt: Date.now() }, readingRef.current);
  };

  /**
   * MUST be memoized. Only theme/locale/translations update in place; any
   * other options change destroys and recreates the editor, losing edits --
   * so `locale` is the only thing in this dependency array. Confirmed from
   * the compiled component (see the unlayer-editor skill): it diffs `locale`
   * out of the remount key itself, so changing it here re-renders `options`
   * but never touches `editorRef`, `hasChanges()`, or either poll above.
   */
  const options = useMemo(
    () => ({
      theme: 'dark' as const,
      locale,
      translations: TOOLBAR_TRANSLATIONS,
      features: {
        imageEditor: {
          tools: { resize: false },
        },
      },
    }) satisfies EditorOptions,
    [locale],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-panel" style={{ minHeight }}>
      {/* Terminal chrome, not the SDK's own save button -- dim and inert until hasChanges() says there's something to transmit. */}
      <div className="flex items-center justify-end border-b border-phosphor-dim/40 px-3 py-1.5">
        <button
          type="button"
          disabled={!hasChanges}
          onClick={() => {
            const dataUrl = ref.current?.editor?.getImage();
            if (dataUrl) handleSave(dataUrl);
          }}
          className={`px-3 py-1 text-[11px] tracking-wider ${
            hasChanges
              ? 'border border-amber text-amber hover:bg-amber/10'
              : 'cursor-not-allowed border border-phosphor-dim/30 text-phosphor-dim/50'
          }`}
        >
          TRANSMIT BULLETIN
        </button>
      </div>
      <ImageEditor
        ref={ref}
        image={image}
        minHeight={minHeight}
        style={{ height: '100%' }}
        options={options}
        onSave={({ dataUrl }: SaveResult) => handleSave(dataUrl)}
        onCancel={() => {
          if (ref.current?.editor?.hasChanges()) {
            requestPrompt({ kind: 'discard-bulletin' });
            return;
          }
          goQueue();
        }}
        onLoadError={() => console.error('Plate failed to load into the canvas')}
        onError={(err: Error) => console.error(err)}
      />
    </div>
  );
}
