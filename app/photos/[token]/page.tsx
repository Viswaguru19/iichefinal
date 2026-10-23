'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';
import { formatPortalDate } from '@/lib/portal-date';
import { downloadEventPhoto, downloadEventPhotos } from '@/lib/event-photo-share';

type SharedPhoto = { id: string; path: string; caption: string | null; url: string };

export default function SharedEventPhotosPage() {
  const params = useParams();
  const token = String(params.token || '');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState('Event photos');
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [photos, setPhotos] = useState<SharedPhoto[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_shared_event_photos', { p_token: token });
      if (cancelled) return;
      if (error || !data) {
        setMissing(true);
        setLoading(false);
        return;
      }
      const row = data as { title?: string; event_date?: string | null; photos?: Array<{ id: string; path: string; caption: string | null }> };
      const list = (row.photos || []).map((p) => {
        const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(p.path);
        return { ...p, url: urlData.publicUrl };
      });
      setTitle(row.title || 'Event photos');
      setEventDate(row.event_date || null);
      setPhotos(list);
      document.title = `${row.title || 'Event photos'} · IIChE`;
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const current = index != null ? photos[index] : null;
  const countLabel = useMemo(() => `${photos.length} photo${photos.length === 1 ? '' : 's'}`, [photos.length]);

  async function saveAll() {
    if (!photos.length || savingAll) return;
    setSavingAll(true);
    try {
      await downloadEventPhotos(photos.map((p) => ({ url: p.url, path: p.path })));
    } finally {
      setSavingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center text-indigo-100">
        Loading photos…
      </div>
    );
  }

  if (missing) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex flex-col items-center justify-center px-6 text-center">
        <img src={DEFAULT_PORTAL_LOGO} alt="" className="w-16 h-16 object-contain mb-4 opacity-80" />
        <h1 className="text-xl font-semibold text-white mb-2">Link not found</h1>
        <p className="text-sm text-indigo-200/80 max-w-sm">This photo link is invalid or has been replaced. Ask the organiser for a new link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[#0b1220]/85 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={DEFAULT_PORTAL_LOGO} alt="IIChE AVVU SC" className="w-10 h-10 object-contain bg-white rounded-lg p-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold truncate">{title}</h1>
            <p className="text-xs text-indigo-200/80 truncate">
              {eventDate ? formatPortalDate(eventDate) : 'IIChE AVVU SC'} · {countLabel}
            </p>
          </div>
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={savingAll}
              className="shrink-0 inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold px-3 py-2 rounded-xl disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {savingAll ? 'Saving…' : 'Download all'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {photos.length === 0 ? (
          <p className="text-center text-indigo-200/70 py-20">No photos have been uploaded for this event yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo, i) => (
              <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-white/5">
                <button type="button" className="block w-full" onClick={() => setIndex(i)}>
                  <img src={photo.url} alt={photo.caption || ''} className="w-full h-36 sm:h-44 object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => void downloadEventPhoto(photo.url, photo.path.split('/').pop() || `photo-${i + 1}.jpg`)}
                  className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/85 text-white text-[11px] font-medium px-2 py-1 rounded-lg inline-flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Save
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {current && index != null && (
        <div className="fixed inset-0 z-40 bg-black/92 flex items-center justify-center">
          <button type="button" onClick={() => setIndex(null)} className="absolute top-4 right-4 text-white p-2" aria-label="Close">
            <X className="w-7 h-7" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((index - 1 + photos.length) % photos.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white bg-white/10 p-2 rounded-full"
                aria-label="Previous"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((index + 1) % photos.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white bg-white/10 p-2 rounded-full"
                aria-label="Next"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          <div className="max-w-5xl w-full px-4 flex flex-col items-center">
            <img src={current.url} alt="" className="max-h-[75vh] max-w-full object-contain rounded-lg" />
            <div className="mt-3 flex items-center gap-3 text-sm text-indigo-100">
              <span>
                {index + 1}/{photos.length}
                {current.caption ? ` · ${current.caption}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void downloadEventPhoto(current.url, current.path.split('/').pop() || `photo-${index + 1}.jpg`)}
                className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-lg"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
