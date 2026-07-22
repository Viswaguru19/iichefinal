'use client';

import { useMemo, useState } from 'react';
import { Loader2, Mail, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { participantGroupLabel } from '@/lib/event-participant-groups';

type Props = {
  eventId: string;
  eventTitle: string;
  participants: any[];
  canSend: boolean;
};

export default function EventParticipantEmailPanel({
  eventId,
  eventTitle,
  participants,
  canSend,
}: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
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
    for (const p of filtered) {
      const email = p.participant_email?.trim().toLowerCase() || '';
      if (email.includes('@')) emails.add(email);
      else noEmail += 1;
    }
    return { total: filtered.length, withEmail: emails.size, noEmail };
  }, [participants, groupFilter]);

  async function handleSend() {
    if (!subject.trim()) {
      toast.error('Enter a subject');
      return;
    }
    if (!message.trim()) {
      toast.error('Enter a message');
      return;
    }
    if (emailStats.withEmail === 0) {
      toast.error('No participants with email in this selection');
      return;
    }

    const ok = window.confirm(
      `Send this email to ${emailStats.withEmail} participant(s) for "${eventTitle}"?`,
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
          message: message.trim(),
          groupFilter: groupFilter === 'all' ? undefined : groupFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      toast.success(data.message || 'Emails sent');
      setOpen(false);
      setSubject('');
      setMessage('');
      setGroupFilter('all');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  }

  if (!canSend) return null;

  return (
    <div className="mb-6">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-lg hover:bg-indigo-50 transition"
        >
          <Mail className="w-4 h-4" />
          Email all participants
        </button>
      ) : (
        <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email registered participants
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-600">
            {emailStats.withEmail} of {emailStats.total} selected participant(s) have an email on file.
            Use <code className="text-indigo-700">{'{{name}}'}</code> in the message to personalize.
          </p>

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
              placeholder={`Update: ${eventTitle}`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder={`Hi {{name}},\n\nYour message about ${eventTitle}...\n\nRegards,\nIIChE AVVU SC`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
