'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export type FeedbackRosterPerson = {
  id: string;
  name: string;
  roll: string;
  submitted?: boolean;
};

type Props = {
  people: FeedbackRosterPerson[];
  value: string;
  onSelect: (person: FeedbackRosterPerson) => void;
  error?: string;
  loading?: boolean;
};

export default function SearchableParticipantSelect({ people, value, onSelect, error, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = people.find((p) => p.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = people.filter((p) => !p.submitted || p.id === value);
    if (!q) return rows;
    return rows.filter(
      (p) => p.name.toLowerCase().includes(q) || p.roll.toLowerCase().includes(q),
    );
  }, [people, query, value]);

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

  const available = people.filter((p) => !p.submitted).length;

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 border-2 outline-none p-2.5 rounded-xl text-left transition-colors bg-white/40 ${
          error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-indigo-500'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-300'}>
          {selected ? `${selected.name}${selected.roll ? ` · ${selected.roll}` : ''}` : 'Search and select your name'}
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
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = filtered.find((p) => !p.submitted);
                  if (first) {
                    onSelect(first);
                    setQuery('');
                    setOpen(false);
                  }
                }
              }}
              placeholder="Type your name…"
              className="w-full text-sm outline-none text-gray-800 placeholder-gray-300 bg-transparent"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {loading ? (
              <li className="px-3 py-2 text-sm text-gray-400">Loading participants…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">
                {available === 0 ? 'Everyone on the roster has already submitted' : 'No matching participant'}
              </li>
            ) : (
              filtered.map((person) => (
                <li key={person.id} role="option" aria-selected={value === person.id}>
                  <button
                    type="button"
                    disabled={person.submitted}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (person.submitted) return;
                      onSelect(person);
                      setQuery('');
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      person.submitted
                        ? 'text-gray-400 cursor-not-allowed'
                        : value === person.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-gray-700 hover:bg-indigo-50'
                    }`}
                  >
                    <span className="block">{person.name}</span>
                    <span className="text-xs text-gray-400">
                      {person.roll || 'Roll not on roster'}
                      {person.submitted ? ' · already submitted' : ''}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">Pick your name from this event’s participants. Your roll number fills in automatically.</p>
    </div>
  );
}
