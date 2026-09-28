'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { FormPage } from '@/lib/form-pages';
import { blankFormPage } from '@/lib/form-pages';

export default function FormPagesEditor({
  pages,
  activePageId,
  onChange,
  onSelect,
}: {
  pages: FormPage[];
  activePageId: string;
  onChange: (pages: FormPage[]) => void;
  onSelect: (pageId: string) => void;
}) {
  const active = pages.find((p) => p.id === activePageId) || pages[0];
  const activeIndex = Math.max(0, pages.findIndex((p) => p.id === active?.id));
  const isLast = activeIndex === pages.length - 1;

  function addPage() {
    const page = blankFormPage(`Page ${pages.length + 1}`);
    onChange([...pages, page]);
    onSelect(page.id);
  }

  function updateActive(patch: Partial<FormPage>) {
    onChange(pages.map((p) => (p.id === active.id ? { ...p, ...patch } : p)));
  }

  function removeActive() {
    if (pages.length <= 1) return;
    const next = pages.filter((p) => p.id !== active.id);
    onChange(next);
    onSelect(next[Math.max(0, activeIndex - 1)].id);
  }

  return (
    <div className="premium-card rounded-2xl p-4 shadow-md space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pages</h3>
        <button
          type="button"
          onClick={addPage}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add page
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
              p.id === active.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white/70 text-gray-600 hover:bg-indigo-50'
            }`}
          >
            {p.title || `Page ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Page title</label>
          <input
            value={active?.title || ''}
            onChange={(e) => updateActive({ title: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Page note (optional)</label>
          <input
            value={active?.description || ''}
            onChange={(e) => updateActive({ description: e.target.value })}
            placeholder="Shown at the top of this page"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white/80 text-sm"
          />
        </div>
      </div>
      {isLast ? (
        <p className="text-xs text-gray-500">
          Last page — after they submit, they are finished. There is no next-page link.
        </p>
      ) : (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 space-y-2">
          <label className="block text-xs font-semibold text-indigo-800">Link after they submit this page</label>
          <p className="text-xs text-indigo-800/80">
            After they complete and submit this page, they click this link to open the next page, fill it, and submit again.
          </p>
          <input
            value={active?.continueLabel || ''}
            onChange={(e) => updateActive({ continueLabel: e.target.value })}
            placeholder="Continue to next page"
            className="w-full border border-indigo-200 rounded-xl px-3 py-2 bg-white text-sm"
          />
        </div>
      )}
      {pages.length > 1 && (
        <button
          type="button"
          onClick={removeActive}
          className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove this page
        </button>
      )}
    </div>
  );
}
