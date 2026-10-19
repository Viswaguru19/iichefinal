'use client';

import { useMemo, useState } from 'react';
import { Loader2, Mail, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { participantGroupLabel } from '@/lib/event-participant-groups';
import { draftParticipantInviteMessage } from '@/lib/event-participant-email-builder';
import { resolveParticipantSendEmail } from '@/lib/event-participant-qr';

type Props = {
  eventId: string;
  eventTitle: string;
  participants: any[];
  canSend: boolean;
  posterUrl?: string | null;
};

export default function EventParticipantEmailPanel({
  eventId,
  eventTitle,
  participants,
  canSend,
  posterUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sending, setSending] = useState(false);

  const groupOptions = useMemo(() => {
    const labels = participants.map((p) => participantGroupLabel(p.participant_group));
    return ['all', ...new Set(labels)];
  }, [participants]);

  const emailStats = useMemo(() => {
    const filtered =
      groupFilter === 'all'
        ? participants
        : participants.filter((p) => participantGroupLabel(p.participant_group) === groupFilter);

    const emails = new Set<string>();
    let noEmail = 0;
    let fromRoll = 0;
    let rollExample = '';
    for (const p of filtered) {
      const resolved = resolveParticipantSendEmail(p);
      if (resolved.email) {
        emails.add(resolved.email);
        if (resolved.fromRoll) {
          fromRoll += 1;
          if (!rollExample) rollExample = resolved.email;
        }
      } else noEmail += 1;
    }
    return { total: filtered.length, withEmail: emails.size, noEmail, fromRoll, rollExample };
  }, [participants, groupFilter]);

  const preview = useMemo(
    () => draftParticipantInviteMessage({ eventTitle, extraNotes }),
    [eventTitle, extraNotes],
  );

  function openComposer() {
    setSubject(`You're invited: ${eventTitle}`);
    setOpen(true);
  }

  async function handleSend() {
    if (!subject.trim()) {
      toast.error('Enter a subject');
      return;
    }
    if (emailStats.withEmail === 0) {
      toast.error('No participants with email in this selection');
      return;
    }

    const ok = window.confirm(
      `Send this invite (poster + attendance QR) to ${emailStats.withEmail} participant(s)? If they have an email on file we use it; otherwise each person is mailed at their own roll@cb.students.amrita.edu${
        emailStats.rollExample ? ` (e.g. ${emailStats.rollExample})` : ''
      }.`,
    );
    if (!ok) return;

    setSending(true);
    try {
      const res = await fetch('/api/events/send-participant-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          subject: subject.trim(),
          extraNotes: extraNotes.trim(),
          groupFilter: groupFilter === 'all' ? undefined : groupFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      toast.success(data.message || 'Emails sent');
      setOpen(false);
      setExtraNotes('');
      setGroupFilter('all');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  }

  if (!canSend) return null;

  return (
    <>
      <button
        type="button"
        onClick={openComposer}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
      >
        <Mail className="w-4 h-4" />
        Email participants
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl border border-indigo-100 shadow-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email participants
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setExtraNotes('');
                }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              {emailStats.withEmail} of {emailStats.total} will be emailed. A stored address is used when
              present; otherwise each person is mailed at{' '}
              <span className="font-medium text-gray-800">their roll@cb.students.amrita.edu</span>
              {emailStats.rollExample ? ` (e.g. ${emailStats.rollExample})` : ''}
              {emailStats.fromRoll ? ` — ${emailStats.fromRoll} from roll numbers` : ''}.
            </p>

            {posterUrl ? (
              <img
                src={posterUrl}
                alt="Event poster"
                className="w-full max-h-40 object-contain rounded-lg border border-indigo-100 bg-indigo-50/40"
              />
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                No poster uploaded yet. The invite and attendance QR will still be sent.
              </p>
            )}

            {groupOptions.length > 2 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Send to group</label>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                >
                  <option value="all">All participants</option>
                  {groupOptions
                    .filter((g) => g !== 'all')
                    .map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Extra points (optional)
              </label>
              <textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                rows={3}
                placeholder="Add any extra points for participants…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Draft (name is filled per person)</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-indigo-50/70 border border-indigo-100 rounded-lg p-3">
                {preview}
              </pre>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={sending || emailStats.withEmail === 0}
                onClick={() => void handleSend()}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send to {emailStats.withEmail} participant(s)
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => {
                  setOpen(false);
                  setExtraNotes('');
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
