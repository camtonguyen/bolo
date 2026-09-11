import { useRef, useState } from 'react';
import { useTerminal } from '../state/terminal';
import { parseOperatorId } from '../lib/brand';
import { playKeyClickFor } from '../audio/sound';

export function LoginScreen() {
  const login = useTerminal((s) => s.login);
  const [value, setValue] = useState('');
  const [rejected, setRejected] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const attempt = () => {
    const operatorId = parseOperatorId(value);
    if (!operatorId) {
      setRejected(true);
      return;
    }
    login(operatorId);
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm space-y-4 px-6">
        <h1 tabIndex={-1} data-screen-heading className="text-xs text-phosphor-dim">
          ENTER OPERATOR ID TO CONTINUE
        </h1>
        <div
          className="flex cursor-text items-center gap-2 border border-phosphor-dim px-3 py-2 focus-within:border-phosphor"
          onClick={() => inputRef.current?.focus()}
        >
          <span className="text-phosphor-dim">&gt;</span>
          <span className="flex-1 uppercase tracking-widest text-phosphor">
            {value}
            {focused && (
              <span
                aria-hidden
                className="ml-px inline-block h-[1em] w-[0.55em] animate-[blink_1s_step-end_infinite] bg-phosphor align-text-bottom"
              />
            )}
          </span>
          <input
            ref={inputRef}
            value={value}
            maxLength={8}
            onChange={(e) => {
              setValue(e.target.value.toUpperCase());
              setRejected(false);
            }}
            onKeyDown={(e) => {
              playKeyClickFor(e.key);
              if (e.key === 'Enter' && value) attempt();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="sr-only"
            aria-label="Operator ID"
          />
        </div>
        {rejected && (
          <p role="alert" className="text-xs text-alert">
            ID REJECTED — 4-8 CHARACTERS, LETTERS AND DIGITS ONLY
          </p>
        )}
        <button
          onClick={() => value && attempt()}
          disabled={!value}
          className="w-full border border-phosphor px-4 py-2 text-xs tracking-widest
                     hover:bg-phosphor hover:text-terminal disabled:opacity-30"
        >
          AUTHENTICATE
        </button>
      </div>
    </div>
  );
}
