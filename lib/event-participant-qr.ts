export const AMRITA_CB_STUDENT_EMAIL_DOMAIN = 'cb.students.amrita.edu';

export function participantMailFromRosterField(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw.toLowerCase();
  const local = raw.replace(/\s+/g, '');
  if (!local) return '';
  return `${local}@${AMRITA_CB_STUDENT_EMAIL_DOMAIN}`;
}

export function isValidParticipantEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const PREVIEW_PARTICIPANT_NAME = 'Test Student';

/** QR that looks like a check-in code but will not mark anyone present. */
export function dummyCheckInPayload(eventId: string): Record<string, unknown> {
  return {
    dummy: true,
    event_id: eventId,
    participant_id: 'preview',
    participant_name: PREVIEW_PARTICIPANT_NAME,
  };
}

function emailFromFormData(formData: unknown): string {
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return '';
  const entries = Object.entries(formData as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (!/mail/i.test(key)) continue;
    const raw = String(value || '').trim().toLowerCase();
    if (raw.includes('@') && isValidParticipantEmail(raw)) return raw;
  }
  for (const [, value] of entries) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw.includes('@') && isValidParticipantEmail(raw)) return raw;
  }
  return '';
}

function campusMailFromRoll(value: string): string {
  const mail = participantMailFromRosterField(value);
  if (mail && isValidParticipantEmail(mail)) return mail.toLowerCase();
  return '';
}

function rollCampusMailFromFormData(formData: unknown): string {
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return '';
  for (const [key, value] of Object.entries(formData as Record<string, unknown>)) {
    if (!/roll|reg(?:istration)?\s*(no\.?|number)?/i.test(key)) continue;
    const raw = String(value || '').trim();
    if (!raw) continue;
    if (!raw.includes('@')) return campusMailFromRoll(raw);
    if (raw.toLowerCase().endsWith(`@${AMRITA_CB_STUDENT_EMAIL_DOMAIN}`)) {
      return raw.toLowerCase();
    }
  }
  return '';
}

/** Always `{roll}@cb.students.amrita.edu` when a roll number can be found. */
export function participantCampusOutlookEmail(participant: {
  participant_email?: string | null;
  form_data?: unknown;
}): string {
  const stored = String(participant.participant_email || '').trim();
  if (stored && !stored.includes('@')) return campusMailFromRoll(stored);

  const fromForm = rollCampusMailFromFormData(participant.form_data);
  if (fromForm) return fromForm;

  if (stored.toLowerCase().endsWith(`@${AMRITA_CB_STUDENT_EMAIL_DOMAIN}`) && isValidParticipantEmail(stored)) {
    return stored.toLowerCase();
  }

  if (stored.includes('@')) {
    const local = stored.split('@')[0].trim();
    if (/^cb[.\-]/i.test(local)) return campusMailFromRoll(local);
  }

  return '';
}

export function outlookAddressList(emails: string[]): string {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))].join('; ');
}

type RosterParticipant = {
  id?: string;
  created_at?: string | null;
  participant_email?: string | null;
  participant_group?: string | null;
  form_data?: unknown;
};

export function orderedUniqueSendEmails(
  participants: RosterParticipant[],
  groupFilter?: string | null,
): string[] {
  const rows =
    groupFilter && groupFilter !== 'all'
      ? participants.filter((row) => (row.participant_group?.trim() || 'Unassigned') === groupFilter)
      : participants;
  const sorted = [...rows].sort((a, b) => {
    const byDate = String(a.created_at || '').localeCompare(String(b.created_at || ''));
    if (byDate) return byDate;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const row of sorted) {
    const email = resolveParticipantSendEmail(row).email.toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

/** Who still needs mail after a send. Uses the failed list when saved; otherwise skips the first N unique addresses (send order). */
export function remainingEmailsAfterSend(opts: {
  participants: RosterParticipant[];
  groupFilter?: string | null;
  failedEmails?: string[] | null;
  sentEmails?: string[] | null;
  deliveredCount?: number | null;
}): { emails: string[]; inferred: boolean } {
  const failed = (opts.failedEmails || [])
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean);
  if (failed.length) return { emails: [...new Set(failed)], inferred: false };

  const ordered = orderedUniqueSendEmails(opts.participants, opts.groupFilter);
  const delivered = new Set(
    (opts.sentEmails || []).map((email) => String(email || '').trim().toLowerCase()).filter(Boolean),
  );
  if (delivered.size) {
    return { emails: ordered.filter((email) => !delivered.has(email)), inferred: false };
  }

  const skip = Math.max(0, Number(opts.deliveredCount) || 0);
  if (skip > 0 && skip < ordered.length) {
    return { emails: ordered.slice(skip), inferred: true };
  }
  return { emails: [], inferred: false };
}

/** Prefer a stored email; otherwise {their roll}@cb.students.amrita.edu. */
export function resolveParticipantSendEmail(participant: {
  participant_email?: string | null;
  form_data?: unknown;
}): { email: string; fromRoll: boolean } {
  const stored = String(participant.participant_email || '').trim();
  if (stored.includes('@')) {
    const email = stored.toLowerCase();
    return { email: isValidParticipantEmail(email) ? email : '', fromRoll: false };
  }
  const fromForm = emailFromFormData(participant.form_data);
  if (fromForm) return { email: fromForm, fromRoll: false };
  const fromRoll = participantMailFromRosterField(stored);
  if (fromRoll && isValidParticipantEmail(fromRoll)) return { email: fromRoll, fromRoll: true };
  return { email: '', fromRoll: false };
}

export function participantMyQrPath(eventId: string) {
  return `/e/${encodeURIComponent(eventId)}/my-qr`;
}

export function participantMatchesLookup(
  participant: {
    participant_email?: string | null;
    form_data?: unknown;
  },
  query: string,
): boolean {
  const q = String(query || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!q) return false;
  const stored = String(participant.participant_email || '').trim().toLowerCase().replace(/\s+/g, '');
  if (stored && (stored === q || stored.split('@')[0] === q)) return true;
  const resolved = resolveParticipantSendEmail(participant).email.toLowerCase();
  if (resolved && (resolved === q || resolved === `${q}@${AMRITA_CB_STUDENT_EMAIL_DOMAIN}`)) return true;
  const campus = participantCampusOutlookEmail(participant);
  if (campus && (campus === q || campus === `${q}@${AMRITA_CB_STUDENT_EMAIL_DOMAIN}`)) return true;
  if (!q.includes('@')) {
    const fromRoll = participantMailFromRosterField(q).toLowerCase();
    if (fromRoll && (resolved === fromRoll || campus === fromRoll)) return true;
  }
  return false;
}

export function participantCheckInPayload(
  participant: {
    id: string;
    participant_name?: string | null;
    participant_email?: string | null;
    qr_data?: string | null;
    created_at?: string | null;
  },
  eventId: string,
): Record<string, unknown> {
  const existing = String(participant.qr_data || '').trim();
  if (existing.startsWith('{')) {
    try {
      const parsed = JSON.parse(existing) as Record<string, unknown>;
      if (parsed && parsed.participant_id) return parsed;
    } catch {
      /* rebuild */
    }
  }
  return {
    participant_id: participant.id,
    event_id: eventId,
    participant_name: participant.participant_name || '',
    participant_email: participant.participant_email || '',
    submitted_at: participant.created_at || new Date().toISOString(),
  };
}
