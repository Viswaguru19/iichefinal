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
}): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const meetingDate = new Date(meeting.meeting_date);
    const formattedDate = meetingDate.toLocaleString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const isOnline = meeting.meeting_type === 'online';

    const typeSpecificHtml = isOnline
        ? `
      ${meeting.platform ? `<p><strong>Platform:</strong> ${meeting.platform.replace(/_/g, ' ')}</p>` : ''}
      ${meeting.meeting_link ? `<p><strong>Meeting Link:</strong> <a href="${meeting.meeting_link}">${meeting.meeting_link}</a></p>` : ''}
    `
        : `<p><strong>Location:</strong> ${meeting.location ?? 'TBD'}</p>`;

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
        <p><strong>Date &amp; Time:</strong> ${formattedDate}</p>
        ${meeting.duration != null ? `<p><strong>Duration:</strong> ${meeting.duration} minutes</p>` : ''}
        <p><strong>Type:</strong> ${isOnline ? 'Online' : 'In-Person'}</p>
        ${typeSpecificHtml}
      </div>

      ${ctaButton}

      <p style="color:#6b7280;font-size:13px;margin-top:32px;">
        IIChE AVVU SC Student Chapter
      </p>
    </div>
  `;
}
