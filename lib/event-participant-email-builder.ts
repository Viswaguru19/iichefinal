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

export function participantInvitePlainText(messageBody: string, recipientName: string): string {
  return messageBody.replace(/\{\{name\}\}/gi, recipientName.trim() || 'Participant');
}

export function draftParticipantInviteMessage(options: {
  eventTitle: string;
  extraNotes?: string;
  eventDate?: string | null;
  location?: string | null;
  qrPageUrl?: string | null;
}): string {
  const extra = String(options.extraNotes || '').trim();
  const extraBlock = extra ? `\n${extra}\n` : '';
  const when = String(options.eventDate || '').trim();
  const where = String(options.location || '').trim();
  const whenLine = when ? `\nDate & time: ${formatPortalDateTime(when)}` : '';
  const whereLine = where ? `\nVenue: ${where}` : '';
  const qrLink = String(options.qrPageUrl || '').trim();
  const qrBlock = qrLink
    ? `\nYour personal check-in QR is unique. If this mail does not show it, open:\n${qrLink}\nEnter your roll number to display your QR at the venue.\n`
    : '\nUse this QR code for attendance at the venue.\n';
  return `Hi {{name}},

We invite you to ${options.eventTitle}.${whenLine}${whereLine}

The event poster is included in this email.
${extraBlock}${qrBlock}
Regards,
IIChE AVVU SC`;
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
  checkInQrDataUrl?: string;
  posterUrl?: string;
}): string {
  const { event, bodyHtml, checkInQrDataUrl, posterUrl } = options;

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

      ${
        posterUrl
          ? `<div style="text-align:center;margin:24px 0;">
        <p style="margin:0 0 12px;font-weight:600;color:#312e81;">Event poster</p>
        <img src="${posterUrl}" alt="Event poster" width="480" style="display:block;margin:0 auto;max-width:100%;border-radius:12px;" />
      </div>`
          : ''
      }

      ${
        checkInQrDataUrl
          ? `<div style="text-align:center;margin:24px 0;padding:16px;background:#eef2ff;border-radius:12px;">
        <p style="margin:0 0 12px;font-weight:600;color:#312e81;">Your check-in QR</p>
        <img src="${checkInQrDataUrl}" alt="Check-in QR" width="220" height="220" style="display:block;margin:0 auto;background:#ffffff;padding:8px;border-radius:8px;" />
        <p style="margin:12px 0 0;font-size:13px;color:#4338ca;">Show this at the venue. If the image does not load, open the attached PNG.</p>
      </div>`
          : ''
      }

      <p style="color:#6b7280;font-size:13px;margin-top:32px;">
        IIChE AVVU Student Chapter, Amrita Vishwa Vidyapeetham, Coimbatore<br/>
        This message is only for registered participants of this event.
        If it is not for you, ignore it or reply to this email.
      </p>
    </div>
  `;
}
