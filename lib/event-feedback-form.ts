import { nanoid } from 'nanoid';
import { defaultOptionsForFieldType, defaultValidationForFieldType } from '@/lib/form-field-types';

export const EVENT_FEEDBACK_FORM_TYPE = 'event_feedback';

export type FeedbackFieldSpec = {
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

const RATING = ['1 — Poor', '2', '3', '4', '5 — Excellent'];

export function defaultEventFeedbackFields(event: {
  title?: string | null;
  guest_name?: string | null;
  location?: string | null;
}): FeedbackFieldSpec[] {
  const speaker = String(event.guest_name || '').trim();
  const fields: FeedbackFieldSpec[] = [
    { label: 'Your name', type: 'text', required: false },
    { label: 'Roll number or email', type: 'text', required: true },
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

export function summarizeFeedbackResponses(
  fields: Array<{ id?: string; label?: string; field_type?: string; options?: string[] }>,
  responses: Array<{ responses?: Record<string, unknown> | null; created_at?: string }>,
) {
  const ratings: Array<{ label: string; average: number; count: number }> = [];
  for (const field of fields) {
    const opts = field.options || [];
    const isRating = opts.some((o) => /^[1-5]\b/.test(String(o))) && opts.length >= 3;
    if (!isRating || !field.id) continue;
    const scores: number[] = [];
    for (const row of responses) {
      const raw = row.responses?.[field.id];
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
  const commentFields = fields.filter((f) => f.field_type === 'textarea' && f.id);
  const comments: Array<{ label: string; text: string }> = [];
  for (const row of responses.slice(0, 12)) {
    for (const field of commentFields) {
      const text = String(row.responses?.[field.id!] || '').trim();
      if (text) comments.push({ label: String(field.label || 'Comment'), text });
      if (comments.length >= 8) break;
    }
    if (comments.length >= 8) break;
  }
  return { count: responses.length, ratings, comments };
}
