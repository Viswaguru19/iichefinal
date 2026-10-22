'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { participantGroupLabel } from '@/lib/event-participant-groups';
import { draftParticipantInviteMessage } from '@/lib/event-participant-email-builder';
import { isValidParticipantEmail, resolveParticipantSendEmail } from '@/lib/event-participant-qr';
import { formatPortalDateTime } from '@/lib/portal-date';

type SendLog = {
  id: string;
  sent_at: string;
  subject: string;
  message_body: string;
  recipient_count: number;
  failed_count: number | null;
  group_filter: string | null;
};

type Props = {
  eventId: string;
  eventTitle: string;
  eventDate?: string | null;
  location?: string | null;
  participants: any[];
  canSend: boolean;
  posterUrl?: string | null;
};

export default function EventParticipantEmailPanel({
  eventId,
  eventTitle,
  eventDate,
  location,
  participants,
  canSend,
  posterUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkEmail, setCheckEmail] = useState('');
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

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

  async function loadSendLogs() {
    const { data } = await supabase
      .from('event_participant_email_sends')
      .select('id, sent_at, subject, message_body, recipient_count, failed_count, group_filter')
      .eq('event_id', eventId)
      .order('sent_at', { ascending: false })
      .limit(20);
    setSendLogs((data as SendLog[]) || []);
  }

  useEffect(() => {
    if (!canSend) return;
    void loadSendLogs();
  }, [canSend, eventId]);

  const automatedMessage = useMemo(
    () => draftParticipantInviteMessage({ eventTitle, eventDate, location }),
    [eventTitle, eventDate, location],
  );

  function openComposer() {
    setSubject(`You're invited: ${eventTitle}`);
    setMessageBody(automatedMessage);
    setOpen(true);
  }

  async function handleCheckEmail() {
    const to = checkEmail.trim().toLowerCase();
    if (!isValidParticipantEmail(to)) {
      toast.error('Enter the email address to send the check to');
      return;
    }
    setChecking(true);
    try {
      const res = await fetch('/api/events/send-participant-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          subject: subject.trim(),
          messageBody: messageBody.trim() || automatedMessage,
          previewTo: to,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send check email');
      toast.success(data.message || `Check email sent to ${to}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send check email');
    } finally {
      setChecking(false);
    }
  }

  async function handleSend() {
    if (!subject.trim()) {
      toast.error('Enter a subject');
      return;
    }
    if (!(messageBody.trim() || automatedMessage).trim()) {
      toast.error('Enter a message');
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
          messageBody: messageBody.trim() || automatedMessage,
          groupFilter: groupFilter === 'all' ? undefined : groupFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      toast.success(data.message || 'Emails sent');
      if (data.log) {
        setSendLogs((prev) => [data.log as SendLog, ...prev.filter((row) => row.id !== data.log.id)]);
        setExpandedLogId(data.log.id);
      } else {
        void loadSendLogs();
      }
      setOpen(true);
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
        {sendLogs[0] ? (
          <span className="text-[10px] font-semibold bg-white/20 px-1.5 py-0.5 rounded-full">
            Last sent {formatPortalDateTime(sendLogs[0].sent_at)}
          </span>
        ) : null}
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
                  setMessageBody('');
                }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sendLogs.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 space-y-2">
                <p className="text-xs font-semibold text-emerald-900">Mail log</p>
                {sendLogs.map((log) => {
                  const openLog = expandedLogId === log.id;
                  return (
                    <div key={log.id} className="rounded-lg bg-white/80 border border-emerald-100 p-2.5">
                      <p className="text-xs text-emerald-900">
                        This mail was already sent to{' '}
                        <span className="font-semibold">{log.recipient_count}</span> participant
                        {log.recipient_count === 1 ? '' : 's'}
                        {log.group_filter ? ` (${log.group_filter})` : ''} at{' '}
                        <span className="font-semibold">{formatPortalDateTime(log.sent_at)}</span>
                        {log.failed_count ? ` · ${log.failed_count} failed` : ''}.
                      </p>
                      <p className="text-[11px] text-gray-600 mt-1 truncate">
                        Subject: {log.subject || '(no subject)'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(openLog ? null : log.id)}
                        className="mt-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        {openLog ? 'Hide content' : 'Show content'}
                      </button>
                      {openLog ? (
                        <pre className="mt-2 text-[11px] text-gray-700 whitespace-pre-wrap break-words bg-slate-50 border border-slate-100 rounded-lg p-2 max-h-40 overflow-y-auto">
                          {log.message_body}
                        </pre>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <p className="text-xs text-gray-600">
              {emailStats.withEmail} of {emailStats.total} will be emailed. A stored address is used when
              present; otherwise each person is mailed at{' '}
              <span className="font-medium text-gray-800">their roll@cb.students.amrita.edu</span>
              {emailStats.rollExample ? ` (e.g. ${emailStats.rollExample})` : ''}
              {emailStats.fromRoll ? ` — ${emailStats.fromRoll} from roll numbers` : ''}.
            </p>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              If the poster or QR does not show in the message body, they are also attached as files
              students can open. Amrita mail may still put the first send in Junk.
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-semibold text-gray-600">Message</label>
                <button
                  type="button"
                  onClick={() => setMessageBody(automatedMessage)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Reset to automated message
                </button>
              </div>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                This starts as the automated invite. Edit it if you need to. Keep{' '}
                <code className="text-[11px]">{'{{name}}'}</code> to insert each participant&apos;s name.
              </p>
            </div>

            <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3 space-y-2">
              <label className="block text-xs font-semibold text-gray-700">
                Send a check email to yourself first
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  value={checkEmail}
                  onChange={(e) => setCheckEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  disabled={checking || sending}
                  onClick={() => void handleCheckEmail()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-200 bg-white text-violet-800 text-sm font-semibold hover:bg-violet-50 disabled:opacity-50"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending check…
                    </>
                  ) : (
                    'Send check with dummy QR'
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Uses this draft and poster. The QR is a dummy and will not mark anyone present.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={sending || checking || emailStats.withEmail === 0}
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
                  setMessageBody('');
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
