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

  const blocked = useMemo(() => {
    const set = new Set<string>();
    takenRolls.forEach((r) => set.add(String(r).trim()));
    excludedRolls.forEach((r) => set.add(String(r).trim()));
    return set;
  }, [takenRolls, excludedRolls]);

  const options = useMemo(
    () => generateRollOptions(count).filter((o) => !blocked.has(o)),
    [count, blocked],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((o) => o.includes(q) || o.startsWith(q));
  }, [options, query]);

  useEffect(() => {
    if (value && blocked.has(value)) onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, blocked]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const availableCount = options.length;

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 border-2 outline-none p-2.5 rounded-xl text-left transition-colors bg-white/40 ${
          error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-indigo-500'
        }`}
      >
        <span className={value ? 'text-gray-800' : 'text-gray-300'}>
          {value || 'Select roll number'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="Search roll no…"
              className="w-full text-sm outline-none text-gray-800 placeholder-gray-300"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">
                {availableCount === 0 ? 'All roll numbers are taken' : 'No match'}
              </li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
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
