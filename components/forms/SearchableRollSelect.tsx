'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { generateRollOptions, ROLL_NO_HINT } from '@/lib/form-field-types';

type Props = {
  count: number;
  value: string;
  onChange: (value: string) => void;
  /** Roll numbers already submitted — hidden from the list. */
  takenRolls?: string[];
  /** Discontinued rolls — hidden from the list. */
  excludedRolls?: string[];
  error?: string;
};

function normalizeRoll(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  // "01" → "1", "23" → "23"
  return String(Number(digits));
}

function rollMatchesQuery(opt: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const qDigits = q.replace(/\D/g, '');
  if (!qDigits) return true;

  // Exact / prefix / contains on the display string
  if (opt === qDigits || opt.startsWith(qDigits) || opt.includes(qDigits)) return true;

  // Numeric equality: "01" matches "1"
  const qNorm = normalizeRoll(qDigits);
  if (qNorm && opt === qNorm) return true;

  return false;
}

export default function SearchableRollSelect({
  count,
  value,
  onChange,
  takenRolls = [],
  excludedRolls = [],
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const blockedKey = useMemo(() => {
    const set = new Set<string>();
    for (const r of takenRolls) {
      const n = normalizeRoll(r);
      if (n) set.add(n);
    }
    for (const r of excludedRolls) {
      const n = normalizeRoll(r);
      if (n) set.add(n);
    }
    return [...set].sort((a, b) => Number(a) - Number(b)).join(',');
  }, [takenRolls, excludedRolls]);

  const blocked = useMemo(() => new Set(blockedKey ? blockedKey.split(',') : []), [blockedKey]);

  const options = useMemo(
    () => generateRollOptions(count).filter((o) => !blocked.has(o)),
    [count, blocked],
  );

  const filtered = useMemo(
    () => options.filter((o) => rollMatchesQuery(o, query)),
    [options, query],
  );

  useEffect(() => {
    if (value && blocked.has(normalizeRoll(value))) onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, blockedKey]);

  useEffect(() => {
    function onDoc(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function openList() {
    setOpen(true);
    setQuery('');
  }

  function selectRoll(opt: string) {
    onChange(opt);
    setQuery('');
    setOpen(false);
  }

  function onQueryChange(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, 2);
    setQuery(next);
    if (!open) setOpen(true);
  }

  const availableCount = options.length;

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        className={`w-full flex items-center justify-between gap-2 border-2 outline-none p-2.5 rounded-xl text-left transition-colors bg-white/40 ${
          error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-indigo-500'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? 'text-gray-800' : 'text-gray-300'}>
          {value || 'Select roll number'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const exact = filtered.find((o) => o === normalizeRoll(query) || o === query.trim());
                  if (exact) selectRoll(exact);
                  else if (filtered.length === 1) selectRoll(filtered[0]);
                }
              }}
              placeholder="Type roll no…"
              className="w-full text-sm outline-none text-gray-800 placeholder-gray-300 bg-transparent"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">
                {availableCount === 0
                  ? 'All roll numbers are taken'
                  : query.trim()
                    ? `No roll matching “${query.trim()}”`
                    : 'No rolls available'}
              </li>
            ) : (
              filtered.map((opt) => (
                <li key={opt} role="option" aria-selected={value === opt}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectRoll(opt)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors ${
                      value === opt ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {opt}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">
        {ROLL_NO_HINT} · {availableCount} available
        {takenRolls.length > 0 ? ` · ${takenRolls.length} taken` : ''}
        {excludedRolls.length > 0 ? ` · ${excludedRolls.length} discontinued` : ''}
      </p>
    </div>
  );
}
