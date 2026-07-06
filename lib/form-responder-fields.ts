/** Legacy fixed ids — still recognized when reading older forms. */
export const RESPONDER_FIELD_NAME_ID = 'f_responder_name';
export const RESPONDER_FIELD_EMAIL_ID = 'f_responder_email';
export const LEGACY_ER_FIELD_NAME_ID = 'f_er_name';
export const LEGACY_ER_FIELD_EMAIL_ID = 'f_er_email';

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minimum shape needed to locate Name/Email questions in a form. */
export type ResponderFieldLike = {
  id: string;
  field_type: string;
  label: string;
};

export interface ResponderFormField extends ResponderFieldLike {
  description?: string;
  options?: string[];
  required?: boolean;
  validation?: Record<string, unknown>;
  order_index?: number;
}

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function isResponderFieldId(id: string | undefined): boolean {
  if (!id) return false;
  return (
    id === RESPONDER_FIELD_NAME_ID ||
    id === RESPONDER_FIELD_EMAIL_ID ||
    id === LEGACY_ER_FIELD_NAME_ID ||
    id === LEGACY_ER_FIELD_EMAIL_ID
  );
}

export function pickNameField<T extends ResponderFieldLike>(fields: T[]): T | undefined {
  return fields.find(
    (f) =>
      f.id === RESPONDER_FIELD_NAME_ID ||
      f.id === LEGACY_ER_FIELD_NAME_ID ||
      (f.field_type === 'text' && /^name$/i.test((f.label || '').trim())),
  );
}

export function pickEmailField<T extends ResponderFieldLike>(fields: T[]): T | undefined {
  return fields.find(
    (f) =>
      f.id === RESPONDER_FIELD_EMAIL_ID ||
      f.id === LEGACY_ER_FIELD_EMAIL_ID ||
      f.field_type === 'email' ||
      /^e-?mail$/i.test((f.label || '').trim()),
  );
}

export function hasNameAndEmailFields<T extends ResponderFieldLike>(fields: T[]): boolean {
  return !!pickNameField(fields) && !!pickEmailField(fields);
}

export function extractResponderEmail(
  responses: Record<string, unknown>,
  fields: ResponderFieldLike[],
  profile?: { email?: string | null } | null,
  user?: { email?: string | null } | null,
): string | null {
  const emailField = pickEmailField(fields);
  if (emailField?.label) {
    const fromLabel = trimStr(responses[emailField.label]);
    if (fromLabel && EMAIL_LIKE.test(fromLabel)) return fromLabel;
  }

  for (const [k, raw] of Object.entries(responses)) {
    const v = trimStr(raw);
    if (!v || !EMAIL_LIKE.test(v)) continue;
    const kl = k.toLowerCase().replace(/\s+/g, ' ');
    if (/\b(e-?mail|correo)\b/.test(kl) || kl.includes('email')) return v;
  }
  for (const [, raw] of Object.entries(responses)) {
    const v = trimStr(raw);
    if (v && EMAIL_LIKE.test(v)) return v;
  }
  const pe = trimStr(profile?.email);
  if (pe && EMAIL_LIKE.test(pe)) return pe;
  const ue = trimStr(user?.email);
  if (ue && EMAIL_LIKE.test(ue)) return ue;
  return null;
}

export function extractResponderName(
  responses: Record<string, unknown>,
  fields: ResponderFieldLike[],
  profile?: { name?: string | null } | null,
): string {
  const nameField = pickNameField(fields);
  if (nameField?.label) {
    const fromLabel = trimStr(responses[nameField.label]);
    if (fromLabel) return fromLabel;
  }

  for (const [k, raw] of Object.entries(responses)) {
    const v = trimStr(raw);
    if (!v) continue;
    const kl = k.toLowerCase();
    if (/name/.test(kl) && !/user\s*name|username|company|team|branch|if\s*name|domain/.test(kl)) return v;
  }
  const pn = trimStr(profile?.name);
  if (pn) return pn;
  return 'Participant';
}

export function getResponderDisplayName(
  responses: Record<string, unknown> | null | undefined,
  fields: ResponderFieldLike[],
  profile?: { name?: string | null } | null,
): string {
  const fromForm = extractResponderName(responses || {}, fields, profile);
  if (fromForm !== 'Participant') return fromForm;
  const pn = trimStr(profile?.name);
  return pn || 'Anonymous';
}

export function getResponderDisplayEmail(
  responses: Record<string, unknown> | null | undefined,
  fields: ResponderFieldLike[],
  profile?: { email?: string | null } | null,
): string {
  return extractResponderEmail(responses || {}, fields, profile) || '';
}
