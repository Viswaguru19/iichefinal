'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { participantGroupLabel } from '@/lib/event-participant-groups';
import { draftParticipantInviteMessage } from '@/lib/event-participant-email-builder';
import {
  isValidParticipantEmail,
  outlookAddressList,
  participantCampusOutlookEmail,
  resolveParticipantSendEmail,
} from '@/lib/event-participant-qr';
import { formatPortalDateTime } from '@/lib/portal-date';
import { mapProfileDisplayNames } from '@/lib/profile-display-names';

type SendLog = {
  id: string;
  sent_at: string;
  subject: string;
  message_body: string;
  recipient_count: number;
  failed_count: number | null;
  group_filter: string | null;
  error_summary?: string | null;
  failed_emails?: string[] | null;
  sent_emails?: string[] | null;
  sent_by?: string | null;
  senderName?: string;
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
  const [page, setPage] = useState<'compose' | 'log'>('log');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sending, setSending] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkEmail, setCheckEmail] = useState('');
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
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

  const outlookMail = useMemo(() => {
    const emails: string[] = [];
    let missing = 0;
    for (const p of participants) {
      const campus = participantCampusOutlookEmail(p);
      if (campus) emails.push(campus);
      else missing += 1;
    }
    return { list: outlookAddressList(emails), count: new Set(emails).size, missing };
  }, [participants]);

  const automatedMessage = useMemo(
    () => draftParticipantInviteMessage({ eventTitle, eventDate, location }),
    [eventTitle, eventDate, location],
  );

  async function loadSendLogs() {
    const { data } = await supabase
      .from('event_participant_email_sends')
      .select(
        'id, sent_at, subject, message_body, recipient_count, failed_count, group_filter, error_summary, failed_emails, sent_emails, sent_by',
      )
      .eq('event_id', eventId)
      .order('sent_at', { ascending: false })
      .limit(100);
    const rows = (data as SendLog[]) || [];
    const names = await mapProfileDisplayNames(
      supabase,
      rows.map((row) => row.sent_by),
    );
    setSendLogs(
      rows.map((row) => ({
        ...row,
        senderName: names[String(row.sent_by || '')] || 'Unknown sender',
      })),
    );
  }

  useEffect(() => {
    if (!canSend) return;
    void loadSendLogs();
  }, [canSend, eventId]);

  useEffect(() => {
    if (draftReady) return;
    setSubject(`You're invited: ${eventTitle}`);
    setMessageBody(automatedMessage);
    setDraftReady(true);
  }, [automatedMessage, eventTitle, draftReady]);

  const remainingLog = useMemo(() => {
    const latest = sendLogs[0];
    if (!latest) return null;
    if ((latest.failed_count || 0) > 0 || (latest.failed_emails?.length || 0) > 0) return latest;
    return null;
  }, [sendLogs]);
  const remainingCount = remainingLog
    ? remainingLog.failed_emails?.length || remainingLog.failed_count || 0
    : 0;

  async function copyOutlookMails() {
    if (!outlookMail.list) {
      toast.error('No roll@cb.students.amrita.edu addresses to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(outlookMail.list);
      toast.success(
        `Copied ${outlookMail.count} address${outlookMail.count === 1 ? '' : 'es'} for Outlook${
          outlookMail.missing ? ` · ${outlookMail.missing} had no roll number` : ''
        }`,
      );
    } catch {
      toast.error('Could not copy. Allow clipboard access and try again.');
    }
  }

  function useLogAsDraft(log: SendLog) {
    setSubject(log.subject || `You're invited: ${eventTitle}`);
    setMessageBody(log.message_body || automatedMessage);
    if (log.group_filter) setGroupFilter(log.group_filter);
    setPage('compose');
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
      await loadSendLogs();
      if (data.log?.id) setExpandedLogId(data.log.id);
      setPage('log');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  }

  async function handleRetryFailed(log: SendLog) {
    const failedCount = log.failed_count || log.failed_emails?.length || 0;
    if (failedCount <= 0) {
      toast.error('Nothing failed on this send');
      return;
    }
    const hasFailedList = (log.failed_emails?.length || 0) > 0;
    const ok = window.confirm(
      hasFailedList
        ? `Send this invite to the ${failedCount} remaining participant${failedCount === 1 ? '' : 's'} whose mail failed?`
        : `This send did not save which addresses failed. Remaining will skip anyone already recorded as delivered. If that list is empty, the ${failedCount} who failed cannot be targeted exactly and some people may get a duplicate. Continue?`,
    );
    if (!ok) return;
    setExpandedLogId(log.id);
    setPage('log');

    setSending(true);
    setRetryingLogId(log.id);
    try {
      const res = await fetch('/api/events/send-participant-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          retryLogId: log.id,
          groupFilter: log.group_filter || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');
      toast.success(data.message || 'Retry finished');
      await loadSendLogs();
      if (data.log?.id) setExpandedLogId(data.log.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setSending(false);
      setRetryingLogId(null);
    }
  }

  if (!canSend) return null;

  const sendCount = sendLogs.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6" />
            Email participants
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {sendCount === 0
              ? 'No participant mail has been sent for this event yet.'
              : `Sent ${sendCount} time${sendCount === 1 ? '' : 's'}. Anyone who can mail participants can open this tab and read the log.`}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Copy all mails gives roll@cb.students.amrita.edu, separated with semicolons for Outlook Bcc.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyOutlookMails()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50"
          >
            <Copy className="w-4 h-4" />
            Copy all mails ({outlookMail.count})
          </button>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setPage('compose')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              page === 'compose' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'
            }`}
          >
            Compose
          </button>
          <button
            type="button"
            onClick={() => setPage('log')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              page === 'log' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'
            }`}
          >
            Mail log{sendCount ? ` (${sendCount})` : ''}
          </button>
          </div>
        </div>
      </div>

      {page === 'log' ? (
        <div className="space-y-3">
          {remainingLog && remainingCount > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-amber-950">
                Latest send: {remainingCount} remaining participant{remainingCount === 1 ? '' : 's'} did
                not get the mail.
              </p>
              <button
                type="button"
                disabled={sending}
                onClick={() => void handleRetryFailed(remainingLog)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                {retryingLogId === remainingLog.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending remaining…
                  </>
                ) : (
                  <>Send to remaining ({remainingCount})</>
                )}
              </button>
            </div>
          ) : null}

          {sendLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center">
              <p className="text-sm text-gray-600">The mail log is empty.</p>
              <button
                type="button"
                onClick={() => setPage('compose')}
                className="mt-3 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Compose the first invite
              </button>
            </div>
          ) : (
            sendLogs.map((log, index) => {
              const sendNumber = sendCount - index;
              const openLog = expandedLogId === log.id;
              const attempted = log.recipient_count + (log.failed_count || 0);
              return (
                <article
                  key={log.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      Send #{sendNumber}
                      <span className="ml-2 text-xs font-medium text-gray-500">
                        {formatPortalDateTime(log.sent_at)}
                      </span>
                    </p>
                    {log.failed_count ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        {log.failed_count} failed
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Delivered
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">
                    Delivered to <span className="font-semibold">{log.recipient_count}</span>
                    {attempted ? (
                      <>
                        {' '}
                        of <span className="font-semibold">{attempted}</span>
                      </>
                    ) : null}{' '}
                    participant{attempted === 1 ? '' : 's'}
                    {log.group_filter ? ` · ${log.group_filter}` : ''}.
                  </p>
                  <p className="text-xs text-gray-500">
                    Sent by <span className="font-medium text-gray-700">{log.senderName || 'Unknown sender'}</span>
                  </p>
                  <p className="text-sm text-gray-800 truncate">
                    Subject: {log.subject || '(no subject)'}
                  </p>
                  {log.error_summary ? (
                    <p className="text-xs text-amber-800">{log.error_summary}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedLogId(openLog ? null : log.id)}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      {openLog ? 'Hide message' : 'Show message'}
                    </button>
                    <button
                      type="button"
                      onClick={() => useLogAsDraft(log)}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Use as draft
                    </button>
                    {(log.failed_count || 0) > 0 ? (
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void handleRetryFailed(log)}
                        className="text-xs font-semibold text-amber-800 hover:text-amber-950 disabled:opacity-50"
                      >
                        {retryingLogId === log.id
                          ? 'Sending remaining…'
                          : `Send to remaining (${log.failed_count})`}
                      </button>
                    ) : null}
                  </div>
                  {openLog ? (
                    <pre className="mt-1 text-xs text-gray-700 whitespace-pre-wrap break-words bg-slate-50 border border-slate-100 rounded-xl p-3 max-h-56 overflow-y-auto">
                      {log.message_body}
                    </pre>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          {remainingLog && remainingCount > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-amber-950">
                {remainingCount} remaining from the latest send.
              </p>
              <button
                type="button"
                disabled={sending}
                onClick={() => void handleRetryFailed(remainingLog)}
                className="text-xs font-semibold text-amber-800 hover:text-amber-950 disabled:opacity-50"
              >
                Send to remaining ({remainingCount})
              </button>
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
        </div>
      )}
    </div>
  );
}
