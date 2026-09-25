import { formatPortalDateTime } from '@/lib/portal-date';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain text with blank lines → safe HTML paragraphs. Supports {{name}} merge field. */
export function plainTextToParticipantEmailHtml(text: string, recipientName?: string): string {
  const name = recipientName?.trim() || 'Participant';
  const placeholder = '\u0000PARTICIPANT_NAME\u0000';
  const withPlaceholder = text.replace(/\{\{name\}\}/gi, placeholder);
  const escaped = escapeHtml(withPlaceholder).replace(
    new RegExp(placeholder, 'g'),
    escapeHtml(name),
  );
  return escaped
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function buildEventParticipantEmail(options: {
  event: {
    id: string;
    title: string;
    event_date?: string | null;
    location?: string | null;
  };
  subject: string;
  bodyHtml: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.iicheavvu.in';
  const { event, bodyHtml } = options;

  let dateLine = '';
  if (event.event_date) {
    const formatted = formatPortalDateTime(event.event_date);
    dateLine = `<p><strong>Date &amp; time:</strong> ${escapeHtml(formatted)}</p>`;
  }

  const locationLine = event.location
    ? `<p><strong>Venue:</strong> ${escapeHtml(event.location)}</p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h2 style="color:#4f46e5;margin-bottom:4px;">${escapeHtml(event.title)}</h2>
      <p style="color:#6b7280;margin-top:0;">IIChE AVVU SC — event update</p>

      <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
        ${dateLine}
        ${locationLine}
      </div>

      ${bodyHtml}

      <a href="${appUrl}/dashboard/event-detail/${event.id}"
         style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 24px;
                text-decoration:none;border-radius:6px;font-weight:600;margin-top:16px;">
        View event
      </a>

      <p style="color:#6b7280;font-size:13px;margin-top:32px;">
        IIChE AVVU SC Student Chapter
      </p>
    </div>
  `;
}
