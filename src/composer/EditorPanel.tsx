import { useEffect, useMemo, useRef, useState } from 'react';
import ImageEditor from '@unlayer/react-image-editor';
import { useTerminal, useAct } from '../state/terminal';
import { evaluate } from '../scoring/recognition';
import type { CompositeConfig } from '../canvas/pipeline';
import type { SuspectId } from '../data/suspects';
import type { EditorOptions, ImageEditorRef, SaveResult } from '../lib/unlayer';
import type { ControlNumber } from '../lib/brand';

interface Props {
  image: string;
  suspect: SuspectId;
  config: CompositeConfig;
  controlNumber: ControlNumber;
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
export function EditorPanel({ image, suspect, config, controlNumber }: Props) {
  const ref = useRef<ImageEditorRef>(null);
  const issue = useTerminal((s) => s.issue);
  const suspicion = useTerminal((s) => s.suspicion);
  const act = useAct();
  const goQueue = useTerminal((s) => s.goQueue);
  const requestPrompt = useTerminal((s) => s.requestPrompt);
  const minHeight = useEditorMinHeight();

  /**
   * MUST be memoized. Only theme/locale/translations update in place; any
   * other options change destroys and recreates the editor, losing edits.
   */
  const options = useMemo(
    () => ({
      theme: 'dark' as const,
      locale: 'en',
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
    [],
  );

  return (
    <div className="flex h-full overflow-hidden bg-panel" style={{ minHeight }}>
      <ImageEditor
        ref={ref}
        image={image}
        minHeight={minHeight}
        style={{ height: '100%' }}
        options={options}
        onSave={({ dataUrl }: SaveResult) => {
          issue(
            { suspect, controlNumber, posterDataUrl: dataUrl, config, issuedAt: Date.now() },
            evaluate(config, suspect, suspicion, act),
          );
        }}
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
