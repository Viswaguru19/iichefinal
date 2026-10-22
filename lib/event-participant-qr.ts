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
