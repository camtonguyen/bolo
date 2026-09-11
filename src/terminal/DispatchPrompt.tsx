import { useEffect, useRef } from 'react';
import { useTerminal, type Prompt } from '../state/terminal';

const COPY: Record<Prompt['kind'], { readonly title: string; readonly body: string }> = {
  'discard-bulletin': {
    title: 'DISCARD BULLETIN',
    body: 'Unsaved changes will be lost. Abort composition?',
  },
};

export function DispatchPrompt() {
  const prompt = useTerminal((s) => s.prompt);
  const resolvePrompt = useTerminal((s) => s.resolvePrompt);
  const panelRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  // Syncs focus into the panel on open and traps Tab/Escape while it's up —
  // both are keyboard state the browser owns, not React.
  useEffect(() => {
    if (!prompt) return;
    continueRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolvePrompt('continue');
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prompt, resolvePrompt]);

  if (!prompt) return null;
  const copy = COPY[prompt.kind];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80">
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dispatch-prompt-title"
        aria-describedby="dispatch-prompt-body"
        className="w-full max-w-sm border border-amber bg-panel p-5 text-xs shadow-[0_0_24px_rgba(255,182,39,0.15)]"
      >
        <p id="dispatch-prompt-title" className="tracking-widest text-amber">
          {copy.title}
        </p>
        <p id="dispatch-prompt-body" className="mt-3 text-phosphor-dim">
          {copy.body}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={() => resolvePrompt('abort')}
            className="border border-alert px-3 py-1.5 tracking-wider text-alert hover:bg-alert/10 focus-visible:outline-alert"
          >
            ABORT
          </button>
          <button
            ref={continueRef}
            onClick={() => resolvePrompt('continue')}
            className="border border-phosphor px-3 py-1.5 tracking-wider text-phosphor hover:bg-phosphor/10"
          >
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
}
