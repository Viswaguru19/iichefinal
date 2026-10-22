import { nanoid } from 'nanoid';
import { defaultOptionsForFieldType, defaultValidationForFieldType } from '@/lib/form-field-types';

export const EVENT_FEEDBACK_FORM_TYPE = 'event_feedback';
export const FEEDBACK_NAME_LABEL = 'Your name';
export const FEEDBACK_ROLL_LABEL = 'Roll number';
export const FEEDBACK_PARTICIPANT_META_KEY = '_participant_id';
export const EVENT_PARTICIPANT_FIELD_TYPE = 'event_participant';

export type FeedbackFieldSpec = {
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

const RATING = ['1 — Poor', '2', '3', '4', '5 — Excellent'];

export function isFeedbackNameField(
  field: { field_type?: string; label?: string },
  formType?: string | null,
): boolean {
  if (field.field_type === EVENT_PARTICIPANT_FIELD_TYPE) return true;
  return formType === EVENT_FEEDBACK_FORM_TYPE && /^your name$/i.test(String(field.label || ''));
}

export function isFeedbackRollField(
  field: { label?: string },
  formType?: string | null,
): boolean {
  return formType === EVENT_FEEDBACK_FORM_TYPE && /^roll number/i.test(String(field.label || ''));
}

export function defaultEventFeedbackFields(event: {
  title?: string | null;
  guest_name?: string | null;
  location?: string | null;
}): FeedbackFieldSpec[] {
  const speaker = String(event.guest_name || '').trim();
  const fields: FeedbackFieldSpec[] = [
    { label: FEEDBACK_NAME_LABEL, type: EVENT_PARTICIPANT_FIELD_TYPE, required: true },
    { label: FEEDBACK_ROLL_LABEL, type: 'text', required: true },
    {
      label: `Overall, how would you rate ${event.title || 'this event'}?`,
      type: 'radio',
      required: true,
      options: RATING,
    },
    {
      label: 'How well was the event organized?',
      type: 'radio',
      required: true,
      options: RATING,
    },
  ];
  if (speaker) {
    fields.push(
      {
        label: `How would you rate ${speaker}'s talk?`,
        type: 'radio',
        required: true,
        options: RATING,
      },
      {
        label: `What did you learn from ${speaker}'s talk?`,
        type: 'textarea',
        required: false,
      },
      {
        label: `Comments for ${speaker}`,
        type: 'textarea',
        required: false,
      },
    );
  }
  if (event.location) {
    fields.push({
      label: `How was the venue (${event.location})?`,
      type: 'radio',
      required: false,
      options: RATING,
    });
  }
  fields.push(
    { label: 'What did you like most?', type: 'textarea', required: false },
    { label: 'What could we improve?', type: 'textarea', required: false },
    {
      label: 'Would you attend a similar event?',
      type: 'radio',
      required: true,
      options: ['Yes', 'Maybe', 'No'],
    },
    { label: 'Anything else?', type: 'textarea', required: false },
  );
  return fields;
}

export function toPortalFormFields(specs: FeedbackFieldSpec[]) {
  return specs.map((row, i) => {
    const type = String(row.type || 'text').trim() || 'text';
    const options =
      Array.isArray(row.options) && row.options.length
        ? row.options.map((o) => String(o))
        : defaultOptionsForFieldType(type);
    return {
      id: `f_${nanoid(7)}`,
      field_type: type,
      label: String(row.label || `Question ${i + 1}`).trim(),
      description: '',
      options,
      required: row.required !== false,
      validation: defaultValidationForFieldType(type),
      order_index: i,
    };
  });
}

export type EventFeedbackDraft = {
  eventId: string;
  eventTitle: string;
  title: string;
  description: string;
  speakerName?: string;
  fields: FeedbackFieldSpec[];
};

export function encodeEventFeedbackDraft(draft: EventFeedbackDraft): string {
  return Buffer.from(JSON.stringify(draft), 'utf8').toString('base64url');
}

export function decodeEventFeedbackDraft(token: string): EventFeedbackDraft | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as EventFeedbackDraft;
    if (!parsed?.eventId || !Array.isArray(parsed.fields)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseEventFeedbackDraftFromText(text: string): EventFeedbackDraft | null {
  const hit = String(text || '').match(/FEEDBACK_FORM_DRAFT:([A-Za-z0-9_-]+);;/);
  return hit?.[1] ? decodeEventFeedbackDraft(hit[1]) : null;
}

export function latestEventFeedbackDraft(
  history?: Array<{ role?: string; content?: string }>,
): EventFeedbackDraft | null {
  for (const msg of [...(history || [])].reverse()) {
    if (msg.role !== 'assistant') continue;
    const draft = parseEventFeedbackDraftFromText(String(msg.content || ''));
    if (draft) return draft;
  }
  return null;
}

export function applyFeedbackFieldEdits(fields: FeedbackFieldSpec[], extraNotes: string): FeedbackFieldSpec[] {
  let next = [...fields];
  const notes = extraNotes.trim();
  if (!notes) return next;

  const remove = notes.match(
    /\b(?:remove|drop|delete)\s+(?:the\s+)?(?:question|field)?\s*(?:about|on|for)?\s*["']?([a-z0-9 /-]{2,40}?)(?=\s+and\b|[.,]|$)/i,
  );
  if (remove?.[1]) {
    const needle = remove[1].replace(/\b(question|field)\b/gi, '').trim().toLowerCase();
    if (needle) next = next.filter((f) => !f.label.toLowerCase().includes(needle));
  }

  const add = notes.match(
    /\b(?:add|include)\s+(?:a\s+)?(?:question|field)?\s*(?:about|on|for)?\s*["']?([a-z0-9 /-]{2,40}?)(?=\s+and\b|[.,]|$)/i,
  );
  if (add?.[1]) {
    const label = add[1].trim().replace(/\s+/g, ' ');
    if (label && !next.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      const wantsRating = /\b(rate|rating|score)\b/i.test(notes);
      next.splice(Math.max(next.length - 1, 0), 0, {
        label: wantsRating ? `How would you rate ${label}?` : `Feedback on ${label}`,
        type: wantsRating ? 'radio' : 'textarea',
        required: false,
        options: wantsRating ? RATING : undefined,
      });
    }
  }
  return next;
}

export function formatEventFeedbackDraftMarkdown(draft: EventFeedbackDraft): string {
  const lines = draft.fields.map((f, i) => {
    const opts = f.options?.length ? ` (${f.options.join(' / ')})` : '';
    const req = f.required === false ? '' : ' *';
    return `${i + 1}. **${f.label}**${req} — ${f.type}${opts}`;
  });
  return [
    `## Draft event feedback form`,
    '',
    `**Event:** ${draft.eventTitle}`,
    draft.speakerName ? `**Speaker:** ${draft.speakerName}` : null,
    `**Title:** ${draft.title}`,
    draft.description ? `**Intro:** ${draft.description}` : null,
    '',
    'Questions:',
    ...lines,
    '',
    'Reply with changes (for example: remove the venue question, add food rating). Say **create it** or **looks good** when this draft is right — I will not publish until you confirm.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function amritaRollToken(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.includes('@')) return amritaRollToken(value.split('@')[0]);
  if (/^[A-Za-z]{2}\.[A-Za-z]{2}\.[A-Za-z0-9.]+$/.test(value)) return value;
  if (/^cb[.\-][A-Za-z0-9.]+$/i.test(value) && /\d/.test(value)) return value;
  return '';
}

function rollFromFormData(formData: unknown): string {
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return '';
  for (const [key, value] of Object.entries(formData as Record<string, unknown>)) {
    if (/e-?mail|correo/i.test(key)) continue;
    if (!/roll|reg(?:istration)?\s*(no\.?|number)?/i.test(key)) continue;
    const raw = String(value || '').trim();
    if (!raw) continue;
    const campus = amritaRollToken(raw);
    if (campus) return campus;
    if (!raw.includes('@')) return raw;
  }
  return '';
}

export function rosterRollDisplay(participant: {
  participant_email?: string | null;
  form_data?: unknown;
}): string {
  const fromForm = rollFromFormData(participant.form_data);
  if (fromForm) return fromForm;
  const stored = String(participant.participant_email || '').trim();
  if (!stored) return '';
  if (!stored.includes('@')) return stored;
  return amritaRollToken(stored);
}

export function responseAnswer(
  responses: Record<string, unknown> | null | undefined,
  field: { id?: string; label?: string },
): string {
  const row = responses || {};
  const byId = field.id != null ? row[field.id] : undefined;
  const byLabel = field.label ? row[field.label] : undefined;
  return String(byId ?? byLabel ?? '').trim();
}

export function matchRosterFeedback(
  participants: Array<{
    id: string;
    participant_name?: string | null;
    participant_email?: string | null;
    form_data?: unknown;
  }>,
  responses: Array<{ responses?: Record<string, unknown> | null; created_at?: string }>,
  fields: Array<{ id?: string; label?: string; field_type?: string; options?: string[] }>,
) {
  const nameField = fields.find(
    (f) => f.field_type === EVENT_PARTICIPANT_FIELD_TYPE || /^your name$/i.test(String(f.label || '')),
  );
  const rollField = fields.find((f) => /^roll number/i.test(String(f.label || '')));
  const used = new Set<string>();
  const given: Array<{
    id: string;
    name: string;
    roll: string;
    answers: Array<{ label: string; text: string }>;
  }> = [];

  for (const row of responses) {
    const pid = String(row.responses?.[FEEDBACK_PARTICIPANT_META_KEY] || '').trim();
    const answeredName = nameField ? responseAnswer(row.responses, nameField) : '';
    const answeredRoll = rollField ? responseAnswer(row.responses, rollField) : '';
    const hit =
      participants.find((p) => p.id === pid) ||
      participants.find((p) => {
        const name = String(p.participant_name || '').trim().toLowerCase();
        const roll = rosterRollDisplay(p).toLowerCase();
        return (
          (answeredName && name === answeredName.toLowerCase()) ||
          (answeredRoll && roll && roll === answeredRoll.toLowerCase())
        );
      });
    if (!hit || used.has(hit.id)) continue;
    used.add(hit.id);
    const answers = fields
      .filter((f) => f.field_type !== EVENT_PARTICIPANT_FIELD_TYPE && !/^your name$/i.test(String(f.label || '')))
      .map((f) => ({ label: String(f.label || ''), text: responseAnswer(row.responses, f) }))
      .filter((a) => a.text && !/^roll number/i.test(a.label));
    given.push({
      id: hit.id,
      name: String(hit.participant_name || 'Participant').trim() || 'Participant',
      roll: rosterRollDisplay(hit),
      answers,
    });
  }

  const pending = participants
    .filter((p) => !used.has(p.id))
    .map((p) => ({
      id: p.id,
      name: String(p.participant_name || 'Participant').trim() || 'Participant',
      roll: rosterRollDisplay(p),
    }));

  return { given, pending, givenCount: given.length, pendingCount: pending.length };
}

export function summarizeFeedbackResponses(
  fields: Array<{ id?: string; label?: string; field_type?: string; options?: string[] }>,
  responses: Array<{ responses?: Record<string, unknown> | null; created_at?: string }>,
) {
  const ratings: Array<{ label: string; average: number; count: number }> = [];
  for (const field of fields) {
    const opts = field.options || [];
    const isRating = opts.some((o) => /^[1-5]\b/.test(String(o))) && opts.length >= 3;
    if (!isRating) continue;
    const scores: number[] = [];
    for (const row of responses) {
      const raw = responseAnswer(row.responses, field);
      const n = parseInt(String(raw || '').trim(), 10);
      if (n >= 1 && n <= 5) scores.push(n);
    }
    if (scores.length) {
      ratings.push({
        label: String(field.label || 'Rating'),
        average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        count: scores.length,
      });
    }
  }
  const commentFields = fields.filter((f) => f.field_type === 'textarea');
  const comments: Array<{ label: string; text: string }> = [];
  for (const row of responses.slice(0, 12)) {
    for (const field of commentFields) {
      const text = responseAnswer(row.responses, field);
      if (text) comments.push({ label: String(field.label || 'Comment'), text });
      if (comments.length >= 8) break;
    }
    if (comments.length >= 8) break;
  }
  return { count: responses.length, ratings, comments };
}
