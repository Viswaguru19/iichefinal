'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import IicheAiChat from '@/components/iiche-ai/IicheAiChat';

export default function IicheAiLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === '/dashboard/ai') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[70] sm:bottom-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
        aria-label="Open IIChE AI"
      >
        <Sparkles className="w-4 h-4" />
        IIChE AI
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="relative z-[81] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl iiche-ai-panel shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="iiche-ai-title text-sm font-bold">IIChE AI</p>
                <p className="iiche-ai-muted text-xs">Ask anything</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/ai" className="iiche-ai-link text-xs font-semibold" onClick={() => setOpen(false)}>
                  Open page
                </Link>
                <button type="button" onClick={() => setOpen(false)} className="iiche-ai-icon-btn p-1.5 rounded-lg" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <IicheAiChat compact />
          </div>
        </div>
      )}
    </>
  );
}
