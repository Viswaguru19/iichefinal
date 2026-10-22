'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { formatPortalDateTime } from '@/lib/portal-date';

export default function MyCheckInQrPage() {
  const params = useParams();
  const eventId = String(params.eventId || '');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    name: string;
    eventTitle: string;
    eventDate?: string | null;
    location?: string | null;
    qrDataUrl: string;
  } | null>(null);

  const title = useMemo(() => result?.eventTitle || 'Check-in QR', [result]);

  async function loadQr(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Enter your roll number or email');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/events/my-checkin-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not find your QR');
      const qrDataUrl = await QRCode.toDataURL(String(data.qrJson), { width: 320, margin: 1 });
      setResult({
        name: data.name,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        location: data.location,
        qrDataUrl,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not find your QR');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-indigo-700">
            IIChE AVVU SC
          </Link>
          <span className="text-xs text-slate-500">Personal check-in QR</span>
        </div>
      </nav>
      <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Enter the roll number or email used on the participant list. Each person has a different
            QR for attendance.
          </p>
        </div>
        <form onSubmit={(e) => void loadQr(e)} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">Roll number or email</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="CB.EN.U4CHE26101"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Finding…' : 'Show my check-in QR'}
          </button>
        </form>
        {result ? (
          <div className="rounded-2xl border border-indigo-100 bg-white p-5 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-900">{result.name}</p>
            {result.eventDate ? (
              <p className="text-xs text-slate-500">{formatPortalDateTime(result.eventDate)}</p>
            ) : null}
            {result.location ? <p className="text-xs text-slate-500">{result.location}</p> : null}
            <img
              src={result.qrDataUrl}
              alt="Your check-in QR"
              className="w-64 h-64 mx-auto bg-white p-2"
            />
            <p className="text-xs text-slate-500">Show this at the venue. Do not share it; it marks only you present.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
