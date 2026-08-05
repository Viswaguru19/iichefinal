'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Member = { id: string; name: string | null; email: string | null };

type Props = {
  allowAll: boolean;
  selectedIds: string[];
  onChange: (next: { allowAll: boolean; ids: string[] }) => void;
};

/** Who may view responses: all portal members, or specific members (+ always admin/faculty/creator). */
export default function ResponseViewerPicker({ allowAll, selectedIds, onChange }: Props) {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('approved', true)
        .order('name')
        .limit(500);
      setMembers((data as Member[]) || []);
      setLoading(false);
    }
    void load();
  }, []);

  const selected = useMemo(() => {
    const set = new Set(selectedIds.map(String));
    return members.filter((m) => set.has(m.id));
  }, [members, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const set = new Set(selectedIds.map(String));
    return members
      .filter((m) => !set.has(m.id))
      .filter((m) => {
        if (!q) return true;
        return (
          (m.name || '').toLowerCase().includes(q) ||
          (m.email || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [members, selectedIds, query]);

  function setAllowAll(next: boolean) {
    onChange({ allowAll: next, ids: next ? [] : selectedIds });
  }

  function add(id: string) {
    if (selectedIds.includes(id)) return;
    onChange({ allowAll: false, ids: [...selectedIds, id] });
    setQuery('');
  }

  function remove(id: string) {
    onChange({ allowAll: false, ids: selectedIds.filter((x) => x !== id) });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-700">Who can view responses</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Admins, faculty, and the form creator always can. Choose all portal members, or pick specific people.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={allowAll}
          onChange={(e) => setAllowAll(e.target.checked)}
          className="rounded text-indigo-600 mt-0.5"
        />
        <span>
          <span className="font-medium text-gray-800">All portal members</span>
          <span className="block text-xs text-gray-400">Anyone signed in to IIChE can open Responses</span>
        </span>
      </label>

      {!allowAll && (
        <>
          {selected.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {selected.map((m) => (
                <li
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium pl-2.5 pr-1 py-1"
                >
                  <span className="max-w-[10rem] truncate">{m.name || m.email || m.id}</span>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="p-0.5 rounded-full hover:bg-indigo-100"
                    aria-label={`Remove ${m.name || m.email}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members by name or email…"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm bg-white/80"
            />
          </div>

          {loading ? (
            <p className="text-xs text-gray-400">Loading members…</p>
          ) : query.trim() && filtered.length === 0 ? (
            <p className="text-xs text-gray-400">No matching members</p>
          ) : filtered.length > 0 && query.trim() ? (
            <ul className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => add(m.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{m.name || 'Unnamed'}</span>
                    {m.email && <span className="text-gray-400 text-xs ml-2">{m.email}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Leave empty for admin/faculty/creator only, or search to add members.</p>
          )}
        </>
      )}
    </div>
  );
}
