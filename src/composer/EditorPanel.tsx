import { useEffect, useMemo, useRef, useState } from 'react';
import ImageEditor from '@unlayer/react-image-editor';
import { useTerminal, useAct } from '../state/terminal';
import { evaluate } from '../scoring/recognition';
import { computeDelta, DIFF_SIZE } from '../canvas/diff';
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
  /** Lifts the live forensic-diff reading up for ComposerStage's readout (Part 1.4) -- display only, EditorPanel keeps its own copy for scoring. */
  onLiveDeltaChange?: (delta: number) => void;
}

/** How often the live poll checks hasChanges() and, if true, re-diffs the editor's own render against the reference bitmap. */
const DELTA_POLL_INTERVAL_MS = 1500;
/** hasChanges() alone is a cheap, synchronous call with no image decode, so the TRANSMIT gate can afford to poll it more often than the delta diff. */
const HAS_CHANGES_POLL_INTERVAL_MS = 500;

/** Decodes a data URL to a DIFF_SIZE x DIFF_SIZE ImageData -- decode and downsample happen together via one scaled drawImage, cheap enough to run on every poll tick. */
function decodeToDeltaBitmap(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = DIFF_SIZE;
      canvas.height = DIFF_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, DIFF_SIZE, DIFF_SIZE);
      resolve(ctx.getImageData(0, 0, DIFF_SIZE, DIFF_SIZE));
    };
    img.onerror = () => reject(new Error('Failed to decode image for forensic diff'));
    img.src = dataUrl;
  });
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
 * Verified API only — see .claude/skills/unlayer-editor/SKILL.md.
 * Props: image, options, editorId, minHeight, style, onLoad, onSave,
 * onCancel, onLoadError, onError.
 */
export function EditorPanel({ image, suspect, config, controlNumber, locale, onLiveDeltaChange }: Props) {
  const ref = useRef<ImageEditorRef>(null);
  const issue = useTerminal((s) => s.issue);
  const suspicion = useTerminal((s) => s.suspicion);
  const act = useAct();
  const goQueue = useTerminal((s) => s.goQueue);
  const requestPrompt = useTerminal((s) => s.requestPrompt);
  const minHeight = useEditorMinHeight();

  const liveDeltaRef = useRef(0);
  const referenceBitmapRef = useRef<ImageData | null>(null);
  const pollBusyRef = useRef(false);
  // Latest-ref so the two effects below can report a delta without taking a
  // fresh-every-render callback identity as a dependency.
  const onLiveDeltaChangeRef = useRef(onLiveDeltaChange);
  useEffect(() => {
    onLiveDeltaChangeRef.current = onLiveDeltaChange;
  });

  const reportLiveDelta = (delta: number) => {
    liveDeltaRef.current = delta;
    onLiveDeltaChangeRef.current?.(delta);
  };

  // Recaptures the forensic reference bitmap whenever `image` changes -- a
  // rail edit (bounty line, overlay toggle) recomposites the plate, which
  // react-image-editor picks up as a new `image` prop and resets itself to
  // internally (see the unlayer-editor skill), so liveDelta must always
  // measure divergence from whatever the editor is currently showing.
  useEffect(() => {
    let cancelled = false;
    reportLiveDelta(0);
    referenceBitmapRef.current = null;
    decodeToDeltaBitmap(image)
      .then((bitmap) => {
        if (!cancelled) referenceBitmapRef.current = bitmap;
      })
      .catch(() => {
        if (!cancelled) referenceBitmapRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [image]);

  // Polls the live editor render to detect in-editor changes the SDK
  // otherwise hides from CompositeConfig -- getImage() is the only window
  // into whatever the player did with the editor's own crop/text/sticker
  // tools. Gated on hasChanges() so an untouched editor never pays for a
  // decode, and skips a tick outright (rather than queuing) if the previous
  // one hasn't finished.
  useEffect(() => {
    const id = setInterval(() => {
      if (pollBusyRef.current) return;
      const editor = ref.current?.editor;
      const reference = referenceBitmapRef.current;
      if (!editor?.hasChanges() || !reference) return;
      const dataUrl = editor.getImage();
      if (!dataUrl) return;
      pollBusyRef.current = true;
      decodeToDeltaBitmap(dataUrl)
        .then((candidate) => {
          reportLiveDelta(computeDelta(reference, candidate));
        })
        .catch(() => {})
        .finally(() => {
          pollBusyRef.current = false;
        });
    }, DELTA_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const [hasChanges, setHasChanges] = useState(false);

  // Polls hasChanges() to gate the external TRANSMIT control in our own
  // chrome -- the only way to know the SDK's internal save button would
  // currently have anything to save, since the SDK exposes no change event.
  useEffect(() => {
    const id = setInterval(() => {
      setHasChanges(ref.current?.editor?.hasChanges() ?? false);
    }, HAS_CHANGES_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Shared by both save paths -- the editor's own internal save button (via
  // onSave) and the external TRANSMIT control (via getImage()) -- so they
  // always produce an identical Bulletin.
  const handleSave = (dataUrl: string) => {
    issue(
      { suspect, controlNumber, posterDataUrl: dataUrl, config, issuedAt: Date.now() },
      evaluate(config, suspect, suspicion, act, liveDeltaRef.current),
    );
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
      translations: {
        en: {
          'image_editor.toolbar.save': 'Issue bulletin',
          'image_editor.toolbar.cancel': 'Abort',
        },
      },
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
