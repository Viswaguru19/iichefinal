'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { EVENT_FEEDBACK_FORM_TYPE, summarizeFeedbackResponses } from '@/lib/event-feedback-form';
import { publicFormUrl } from '@/lib/form-public-access';

export default function EventFeedbackSummary({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ id: string; title: string; fields?: any[] } | null>(null);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeFeedbackResponses> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: forms } = await supabase
        .from('forms')
        .select('id, title, fields')
        .eq('event_id', eventId)
        .eq('form_type', EVENT_FEEDBACK_FORM_TYPE)
        .order('created_at', { ascending: false })
        .limit(1);
      const row = forms?.[0] || null;
      if (!row) {
        if (!cancelled) {
          setForm(null);
          setSummary(null);
          setLoading(false);
        }
        return;
      }
      const { data: responses } = await supabase
        .from('form_responses')
        .select('responses, created_at')
        .eq('form_id', row.id)
        .order('created_at', { ascending: false })
        .limit(80);
      if (cancelled) return;
      setForm(row);
      setSummary(
        summarizeFeedbackResponses(
          Array.isArray(row.fields) ? row.fields : [],
          responses || [],
        ),
      );
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading feedback…</p>;
  }

  if (!form) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Event feedback</h3>
        <p className="text-sm text-gray-500 mt-1">
          No feedback form yet. Create one under Forms → Event Feedback, or ask IIChE AI to draft it.
        </p>
        <Link href="/dashboard/forms/create" className="text-sm font-semibold text-indigo-700 mt-2 inline-block">
          Create feedback form
        </Link>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Event feedback</h3>
          <p className="text-xs text-gray-500">{form.title}</p>
        </div>
        <p className="text-sm font-semibold text-indigo-800">{summary?.count || 0} response{(summary?.count || 0) === 1 ? '' : 's'}</p>
      </div>
      {summary?.ratings.length ? (
        <ul className="space-y-1">
          {summary.ratings.map((row) => (
            <li key={row.label} className="text-sm text-gray-700">
              {row.label}: <span className="font-semibold">{row.average}/5</span>
              <span className="text-xs text-gray-500"> ({row.count})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No ratings yet.</p>
      )}
      {summary?.comments.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recent comments</p>
          {summary.comments.map((row, i) => (
            <p key={`${row.label}-${i}`} className="text-sm text-gray-700 rounded-lg bg-slate-50 p-2">
              <span className="text-xs text-gray-500 block">{row.label}</span>
              {row.text}
            </p>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link href={`/dashboard/forms/${form.id}/responses`} className="text-indigo-700">
          All responses
        </Link>
        {origin ? (
          <a href={publicFormUrl(origin, form.id)} className="text-indigo-700" target="_blank" rel="noreferrer">
            Public form
          </a>
        ) : null}
      </div>
    </div>
  );
}
