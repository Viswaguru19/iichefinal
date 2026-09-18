const IST = 'Asia/Kolkata';

function formatMeetingDateParts(iso: string) {
  const meetingDate = new Date(iso);
  const date = meetingDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: IST,
  });
  const time = meetingDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  });
  return { date, time };
}

/**
 * Builds the HTML email body for a meeting notification.
 * Handles both online and offline meetings.
 */
export function buildMeetingNotificationEmail(meeting: {
  id: string;
  title: string;
  description?: string | null;
  meeting_type: 'online' | 'offline';
  meeting_date: string;
  duration?: number | null;
  location?: string | null;
  platform?: string | null;
  meeting_link?: string | null;
  agenda?: string | null;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.iicheavvu.in';
  const { date: formattedDate, time: formattedTime } = formatMeetingDateParts(meeting.meeting_date);

  const isOnline = meeting.meeting_type === 'online';

  const typeSpecificHtml = isOnline
    ? `
      ${meeting.platform ? `<p><strong>Platform:</strong> ${meeting.platform.replace(/_/g, ' ')}</p>` : ''}
      ${meeting.meeting_link ? `<p><strong>Meeting Link:</strong> <a href="${meeting.meeting_link}">${meeting.meeting_link}</a></p>` : ''}
    `
    : `<p><strong>Place:</strong> ${meeting.location ?? 'TBD'}</p>`;

  const ctaButton = `
    <a href="${appUrl}/dashboard/meetings/${meeting.id}"
       style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;
              text-decoration:none;border-radius:6px;font-weight:600;margin-top:16px;">
      View Meeting
    </a>
  `;

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h2 style="color:#2563eb;margin-bottom:4px;">Meeting Invitation</h2>
      <p style="color:#6b7280;margin-top:0;">You have been invited to a meeting.</p>

      <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
        <h3 style="margin-top:0;">${meeting.title}</h3>
        ${meeting.description ? `<p>${meeting.description}</p>` : ''}
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime} IST</p>
        ${meeting.duration != null ? `<p><strong>Duration:</strong> ${meeting.duration} minutes</p>` : ''}
        <p><strong>Type:</strong> ${isOnline ? 'Online' : 'In-Person'}</p>
        ${typeSpecificHtml}
        ${meeting.agenda ? `<p><strong>Agenda:</strong><br>${meeting.agenda}</p>` : ''}
      </div>

      ${ctaButton}

      <p style="color:#6b7280;font-size:13px;margin-top:32px;">
        IIChE AVVU Student Chapter · Amrita Vishwa Vidyapeetham, Coimbatore
      </p>
    </div>
  `;
}

export function buildMeetingNotificationText(meeting: {
  title: string;
  description?: string | null;
  meeting_type: 'online' | 'offline';
  meeting_date: string;
  duration?: number | null;
  location?: string | null;
  platform?: string | null;
  meeting_link?: string | null;
  agenda?: string | null;
}): string {
  const { date, time } = formatMeetingDateParts(meeting.meeting_date);
  const isOnline = meeting.meeting_type === 'online';
  const lines = [
    'IIChE AVVU Student Chapter — Meeting Invitation',
    '',
    meeting.title,
    meeting.description || '',
    `Date: ${date}`,
    `Time: ${time} IST`,
    meeting.duration != null ? `Duration: ${meeting.duration} minutes` : '',
    `Type: ${isOnline ? 'Online' : 'In-Person'}`,
    isOnline
      ? [meeting.platform ? `Platform: ${meeting.platform.replace(/_/g, ' ')}` : '', meeting.meeting_link ? `Join: ${meeting.meeting_link}` : ''].filter(Boolean).join('\n')
      : `Place: ${meeting.location ?? 'TBD'}`,
    meeting.agenda ? `Agenda: ${meeting.agenda}` : '',
    '',
    'Amrita Vishwa Vidyapeetham, Coimbatore',
  ];
  return lines.filter((line) => line !== '').join('\n');
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildMeetingCalendarInvite(meeting: {
  id: string;
  title: string;
  description?: string | null;
  meeting_type: 'online' | 'offline';
  meeting_date: string;
  duration?: number | null;
  location?: string | null;
  meeting_link?: string | null;
  agenda?: string | null;
}): string {
  const start = new Date(meeting.meeting_date);
  const end = new Date(start.getTime() + (meeting.duration || 60) * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const location =
    meeting.meeting_type === 'online' ? meeting.meeting_link || 'Online' : meeting.location || 'TBD';
  const description = [meeting.description, meeting.agenda].filter(Boolean).join('\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IIChE AVVU SC//Meeting//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@iicheavvu.in`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeIcs(meeting.title || 'Meeting')}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Meeting reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
