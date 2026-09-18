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

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || '')).filter(Boolean))];
}

async function facultyCoordinatorEmails(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .or('is_faculty.eq.true,role.eq.faculty_advisor');
  return uniqueEmails((data || []).map((p: any) => p.email));
}

async function emailsForUserIds(supabase: any, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase.from('profiles').select('email').in('id', userIds);
  return uniqueEmails((data || []).map((p: any) => p.email));
}

async function sendToRecipients(
  recipients: string[],
  subject: string,
  emailHtml: string,
  mailOptions: Parameters<typeof sendEmail>[3],
): Promise<InviteResult> {
  if (recipients.length === 0) {
    return { error: 'No participants found', status: 400, sentCount: 0, total: 0 };
  }

  let sentCount = 0;
  let lastError = '';
  for (const email of recipients) {
    const result = await sendEmail(email, subject, emailHtml, mailOptions);
    if (result.success) sentCount++;
    else lastError = result.error || 'Failed to send email';
  }

  if (sentCount === 0) {
    return {
      error: lastError || 'Failed to send invitation emails. Check RESEND_API_KEY on the server.',
      status: 502,
      sentCount: 0,
      total: recipients.length,
    };
  }

  return {
    success: true,
    sentCount,
    total: recipients.length,
    message: `Invitations sent to ${sentCount} of ${recipients.length} email(s)`,
  };
}

export async function sendMeetingInvitationEmails(
  supabase: any,
  {
    meetingId,
    customEmails,
    includeFaculty = false,
  }: { meetingId: string; customEmails?: string[]; includeFaculty?: boolean },
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

  const facultyEmails = includeFaculty ? await facultyCoordinatorEmails(supabase) : [];
  const organizerEmail = meeting.creator?.email;

  if (customEmails && Array.isArray(customEmails) && customEmails.length > 0) {
    const valid = uniqueEmails([...customEmails, ...facultyEmails, organizerEmail]);
    return sendToRecipients(valid, subject, emailHtml, mailOptions);
  }

  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('user_id, profiles:user_id(name, email)')
    .eq('meeting_id', meetingId);

  const participantEmails = uniqueEmails(
    (participants || []).map((p: any) => p.profiles?.email),
  );
  const storedIds = asIdList(meeting.participants);
  const participantRowIds = asIdList((participants || []).map((p: any) => p.user_id));
  const missingIds = storedIds.filter((id) => !participantRowIds.includes(id));
  const fallbackEmails = await emailsForUserIds(supabase, missingIds.length ? missingIds : storedIds);

  const recipients = uniqueEmails([
    ...participantEmails,
    ...fallbackEmails,
    ...facultyEmails,
    organizerEmail,
  ]);

  return sendToRecipients(recipients, subject, emailHtml, mailOptions);
}
