import { useEffect, useRef, useState } from 'react';
import { useTerminal } from '../state/terminal';
import { TOTAL_RECORDS_INDEXED } from '../data/suspects';
import { BOOT_MOTION } from './motion';
import { currentLineIndex, revealLines, useTypedReveal } from './typedReveal';

function postLine(label: string, value: string, dotsTarget = 30): string {
  const dots = '.'.repeat(Math.max(3, dotsTarget - label.length));
  return `${label} ${dots} ${value}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** UTC so the stamp doesn't depend on the operator's local timezone. */
export function formatSyncStamp(now: Date): string {
  const date = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
  const time = `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:${pad2(now.getUTCSeconds())}`;
  return `${date} ${time}Z`;
}

export function getBootLines(now: Date): string[] {
  return [
    'LEONIDA STATE POLICE',
    'WANTED DIVISION — TERMINAL 07',
    '',
    postLine('POST diagnostics', 'OK'),
    postLine('Record index', `${TOTAL_RECORDS_INDEXED.toLocaleString()} entries`),
    postLine('Case backlog', '1,884 open'),
    postLine('Dispatch uplink', 'ESTABLISHED'),
    postLine('Uplink handshake', '42ms'),
    postLine('Last sync', formatSyncStamp(now)),
    '',
    'AUTHORISED PERSONNEL ONLY',
  ];
}

export function BootSequence() {
  const boot = useTerminal((s) => s.boot);
  const [lines] = useState(() => getBootLines(new Date()));
  const totalChars = lines.reduce((n, line) => n + line.length, 0);
  const [revealedCount, skip] = useTypedReveal(totalChars, BOOT_MOTION.charIntervalMs);
  const mountedAt = useRef(Date.now()).current;

  // Any key skips straight to the final frame, once past the grace window.
  useEffect(() => {
    const onKeyDown = () => {
      if (Date.now() - mountedAt >= BOOT_MOTION.skipAfterMs) skip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mountedAt, skip]);

  // Once the reveal reaches the final frame, hold briefly then advance.
  useEffect(() => {
    if (revealedCount < totalChars) return;
    const t = setTimeout(boot, BOOT_MOTION.holdAfterMs);
    return () => clearTimeout(t);
  }, [revealedCount, totalChars, boot]);

  const visibleLines = revealLines(lines, revealedCount);
  const cursorLine = currentLineIndex(lines, revealedCount);

  return (
    <pre tabIndex={-1} data-screen-heading className="h-full overflow-hidden p-8 text-xs leading-relaxed text-phosphor sm:text-sm">
      {visibleLines.map((line, i) => (
        <div key={i}>
          {line || ' '}
          {i === cursorLine && (
            <span className="ml-px inline-block h-[1em] w-[0.55em] animate-[blink_1s_step-end_infinite] bg-phosphor align-text-bottom" />
          )}
        </div>
      ))}
    </pre>
  );
}
