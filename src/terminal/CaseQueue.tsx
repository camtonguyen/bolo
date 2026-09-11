import { useRef, useState } from 'react';
import { useTerminal } from '../state/terminal';
import { playKeyClickFor } from '../audio/sound';
import {
  OPERATOR_RECORD_ID,
  SUSPECTS,
  TOTAL_RECORDS_INDEXED,
  type Suspect,
  type SuspectId,
} from '../data/suspects';

export type SuspectRow = Suspect & { id: SuspectId };
export type SortDirection = 'asc' | 'desc';

const COLUMNS = [
  { key: 'id', label: 'RECORD', sortable: true, align: 'left', responsive: false },
  { key: 'name', label: 'NAME', sortable: true, align: 'left', responsive: false },
  { key: 'charge', label: 'CHARGE', sortable: false, align: 'left', responsive: true },
  { key: 'bounty', label: 'BOUNTY', sortable: true, align: 'right', responsive: false },
] as const;

type Column = (typeof COLUMNS)[number];
/** Derived from the config above — a new sortable column can't drift out of sync with this type. */
export type SortableColumn = Extract<Column, { sortable: true }>['key'];

const SORT_ACCESSORS: Record<SortableColumn, (row: SuspectRow) => string | number> = {
  id: (row) => row.id,
  name: (row) => row.name,
  bounty: (row) => row.bounty,
};

export const DEFAULT_DIRECTIONS: Record<SortableColumn, SortDirection> = {
  id: 'asc',
  name: 'asc',
  bounty: 'desc',
};

export function matchesQuery(row: SuspectRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.id, row.name, row.alias, row.charge].some((field) => field.toLowerCase().includes(q));
}

export function sortRows(
  rows: readonly SuspectRow[],
  sort: { column: SortableColumn; direction: SortDirection },
): SuspectRow[] {
  const accessor = SORT_ACCESSORS[sort.column];
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
}

export function CaseQueue() {
  const openRecord = useTerminal((s) => s.openRecord);
  const revealed = useTerminal((s) => s.revealed);
  const operatorNoticed = useTerminal((s) => s.operatorNoticed);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ column: SortableColumn; direction: SortDirection }>({
    column: 'bounty',
    direction: 'desc',
  });
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const rows: SuspectRow[] = (Object.keys(SUSPECTS) as SuspectId[])
    .filter((id) => id !== OPERATOR_RECORD_ID || revealed)
    .map((id) => ({ id, ...SUSPECTS[id] }));

  const visible = sortRows(
    rows.filter((row) => matchesQuery(row, query)),
    sort,
  );

  const toggleSort = (column: SortableColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: DEFAULT_DIRECTIONS[column] },
    );
  };

  const focusRow = (index: number) => {
    rowRefs.current[index]?.focus();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      {revealed && !operatorNoticed && <DispatchNotification />}
      <h1 tabIndex={-1} data-screen-heading className="text-sm tracking-widest text-amber">
        OPEN CASES — {rows.length}
      </h1>
      <p className="mt-1 mb-4 text-[11px] text-phosphor-dim">
        {TOTAL_RECORDS_INDEXED.toLocaleString()} indexed · {rows.length} assigned
      </p>

      <div className="mb-4 flex items-center gap-2 border border-phosphor-dim px-3 py-1.5 text-xs">
        <span className="text-phosphor-dim">SEARCH &gt;</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => playKeyClickFor(e.key)}
          className="flex-1 bg-transparent text-phosphor"
          aria-label="Search cases"
        />
      </div>

      <table className="w-full text-left text-xs">
        <thead className="text-phosphor-dim">
          <tr className="border-b border-phosphor-dim">
            {COLUMNS.map((col, i) => (
              <th
                key={col.key}
                aria-sort={
                  col.sortable && sort.column === col.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                className={`${i < COLUMNS.length - 1 ? 'border-r border-phosphor-dim/30' : ''}
                            ${col.align === 'right' ? 'text-right' : ''}
                            ${col.responsive ? 'hidden sm:table-cell' : ''}`}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`flex w-full items-center gap-1 py-2 hover:text-phosphor
                                ${col.align === 'right' ? 'justify-end' : ''}`}
                  >
                    {col.label}
                    {sort.column === col.key && (
                      <span aria-hidden>{sort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                ) : (
                  <span className="block py-2">{col.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => {
            const isOperator = row.id === OPERATOR_RECORD_ID;
            return (
              <tr
                key={row.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onClick={() => openRecord(row.id)}
                tabIndex={0}
                aria-label={`${row.id}, ${row.name}, ${row.charge}, bounty $${row.bounty.toLocaleString()}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openRecord(row.id);
                  else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusRow(i + 1);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusRow(i - 1);
                  }
                }}
                className={`group cursor-pointer border-b border-phosphor-dim/30 hover:bg-panel
                            focus-visible:bg-panel ${isOperator ? 'text-alert' : ''}`}
              >
                <td className="border-r border-phosphor-dim/20 py-3 group-hover:underline group-hover:decoration-phosphor">
                  {row.id}
                </td>
                <td className="border-r border-phosphor-dim/20 group-hover:underline group-hover:decoration-phosphor">
                  {row.name}
                </td>
                <td className="hidden border-r border-phosphor-dim/20 sm:table-cell">{row.charge}</td>
                <td className="text-right group-hover:underline group-hover:decoration-phosphor">
                  ${row.bounty.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {visible.length === 0 && <p className="mt-6 text-xs text-phosphor-dim">NO RECORDS MATCH.</p>}
    </div>
  );
}

/**
 * Routine dispatch chatter, not an explanation — it flags a priority
 * assignment the way any other one would. What it's an assignment of is for
 * the player to notice on their own, in the case officer field.
 */
function DispatchNotification() {
  return (
    <div
      aria-live="polite"
      className="mb-4 flex items-center gap-2 border border-alert bg-alert/10 px-3 py-2 text-xs tracking-widest text-alert"
    >
      <span aria-hidden className="h-2 w-2 flex-none animate-[blink_1s_step-end_infinite] rounded-full bg-alert" />
      DISPATCH — NEW RECORD ASSIGNED — PRIORITY
    </div>
  );
}
