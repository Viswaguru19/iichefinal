import { sendEmail } from '@/lib/notifications';
import {
  buildMeetingCalendarInvite,
  buildMeetingNotificationEmail,
  buildMeetingNotificationText,
} from '@/lib/meeting-email-builder';

type InviteResult = {
  success?: boolean;
  error?: string;
  status?: number;
  sentCount: number;
  total: number;
  message?: string;
};

function uniqueEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = String(raw || '').trim();
    if (!email.includes('@')) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

async function facultyCoordinatorEmails(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .or('is_faculty.eq.true,role.eq.faculty_advisor');
  return uniqueEmails((data || []).map((p: any) => p.email));
}

export async function sendMeetingInvitationEmails(
  supabase: any,
  { meetingId, customEmails }: { meetingId: string; customEmails?: string[] },
): Promise<InviteResult> {
  const { data: meeting } = await supabase
    .from('meetings')
    .select(`*, creator:created_by(name, email), committee:committee_id(name)`)
    .eq('id', meetingId)
    .single();

  if (!meeting) {
    return { error: 'Meeting not found', status: 404, sentCount: 0, total: 0 };
  }

  const emailHtml = buildMeetingNotificationEmail(meeting);
  const emailText = buildMeetingNotificationText(meeting);
  const ics = buildMeetingCalendarInvite(meeting);
  const subject = `Meeting Invitation: ${meeting.title}`;
  const mailOptions = {
    text: emailText,
    attachments: [
      {
        filename: 'meeting-invite.ics',
        content: Buffer.from(ics, 'utf8'),
        contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
      },
    ],
    headers: {
      'Content-Class': 'urn:content-classes:calendarmessage',
    },
  };

  const facultyEmails = await facultyCoordinatorEmails(supabase);

  if (customEmails && Array.isArray(customEmails) && customEmails.length > 0) {
    const valid = uniqueEmails([...customEmails, ...facultyEmails]);
    let sentCount = 0;
    for (const email of valid) {
      const result = await sendEmail(email, subject, emailHtml, mailOptions);
      if (result.success) sentCount++;
    }
    return {
      success: true,
      sentCount,
      total: valid.length,
      message: `Invitations sent to ${sentCount} of ${valid.length} email(s)`,
    };
  }

  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('profiles:user_id(name, email)')
    .eq('meeting_id', meetingId);

  const participantEmails = uniqueEmails(
    (participants || []).map((p: any) => p.profiles?.email),
  );
  const recipients = uniqueEmails([...participantEmails, ...facultyEmails]);

  if (recipients.length === 0) {
    return { error: 'No participants found', status: 400, sentCount: 0, total: 0 };
  }

  let sentCount = 0;
  for (const email of recipients) {
    const result = await sendEmail(email, subject, emailHtml, mailOptions);
    if (result.success) sentCount++;
  }

  return {
    success: true,
    sentCount,
    total: recipients.length,
    message: `Invitations sent to ${sentCount} of ${recipients.length} participants`,
  };
}
