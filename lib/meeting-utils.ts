// ============================================
// MEETING MANAGEMENT UTILITIES
// With Microsoft Teams Integration
// ============================================

import { createClient } from '@/lib/supabase/client';
import type { MeetingType, MeetingPlatform } from '@/types/database';

interface MeetingData {
    title: string;
    description?: string;
    meeting_type: MeetingType;
    meeting_date: string;
    duration?: number;
    location?: string;
    platform?: MeetingPlatform;
    committee_id?: string;
    participants: string[];
    agenda?: string;
}

// ============================================
// MEETING CREATION
// ============================================

export async function createMeeting(
    meetingData: MeetingData,
    creatorId: string
) {
    const supabase = createClient();

    let meetingLink: string | undefined;

    // Generate meeting link for online meetings
    if (meetingData.meeting_type === 'online') {
        meetingLink = await generateMeetingLink(
            meetingData.platform || 'microsoft_teams',
            meetingData.title,
            meetingData.meeting_date,
            meetingData.duration
        );
    }

    // Create meeting
    const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
            ...meetingData,
            meeting_link: meetingLink,
            created_by: creatorId,
        })
        .select()
        .single();

    if (error) throw error;

    // Add participants
    const participants = meetingData.participants.map((userId) => ({
        meeting_id: meeting.id,
        user_id: userId,
    }));

    const { error: participantsError } = await supabase
        .from('meeting_participants')
        .insert(participants);

    if (participantsError) throw participantsError;

    // Send meeting invitations
    await sendMeetingInvitations(meeting, meetingData.participants);

    return meeting;
}

// ============================================
// MEETING LINK GENERATION
// ============================================

async function generateMeetingLink(
    platform: MeetingPlatform,
    title: string,
    date: string,
    duration?: number
): Promise<string> {
    switch (platform) {
        case 'microsoft_teams':
            return generateTeamsLink(title, date, duration);

        case 'google_meet':
            return generateGoogleMeetLink();

        case 'zoom':
            return generateZoomLink(title, date, duration);

        default:
            return '';
    }
}

// Microsoft Teams link generation
async function generateTeamsLink(
    title: string,
    date: string,
    duration?: number
): Promise<string> {
    // In production, this would use Microsoft Graph API
    // For now, return a placeholder that can be manually updated

    // Example Graph API call structure:
    // POST https://graph.microsoft.com/v1.0/me/onlineMeetings
    // {
    //   "startDateTime": date,
    //   "endDateTime": calculateEndTime(date, duration),
    //   "subject": title
    // }

    // Placeholder for manual Teams link
    return `https://teams.microsoft.com/l/meetup-join/[TO_BE_CONFIGURED]`;
}

// Google Meet link generation
async function generateGoogleMeetLink(): Promise<string> {
    // In production, use Google Calendar API
    // For now, return a placeholder
    return `https://meet.google.com/[TO_BE_CONFIGURED]`;
}

// Zoom link generation
async function generateZoomLink(
    title: string,
    date: string,
    duration?: number
): Promise<string> {
    // In production, use Zoom API
    // For now, return a placeholder
    return `https://zoom.us/j/[TO_BE_CONFIGURED]`;
}

// ============================================
// MEETING INVITATIONS
// ============================================

async function sendMeetingInvitations(meeting: any, participantIds: string[]) {
    const supabase = createClient();

    // Get participant details
    const { data: participants } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', participantIds);

    if (!participants) return;

    // Create email content
    const emailSubject = `Meeting Invitation: ${meeting.title}`;
    const emailBody = generateMeetingEmailBody(meeting);

    // Send emails to all participants
    for (const participant of participants) {
        await sendMeetingEmail(participant.email, emailSubject, emailBody);

        // Create notification
        await supabase.from('notifications').insert({
            user_id: participant.id,
            title: 'New Meeting Invitation',
            message: `You have been invited to: ${meeting.title}`,
            type: 'meeting',
            related_id: meeting.id,
        });
    }
}

function generateMeetingEmailBody(meeting: any): string {
    const meetingDate = new Date(meeting.meeting_date);
    const formattedDate = meetingDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const formattedTime = meetingDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    });

    let locationInfo = '';
    if (meeting.meeting_type === 'online') {
        locationInfo = `
      <p><strong>Join Link:</strong> <a href="${meeting.meeting_link}">${meeting.meeting_link}</a></p>
      <p><strong>Platform:</strong> ${meeting.platform || 'Microsoft Teams'}</p>
    `;
    } else {
        locationInfo = `<p><strong>Location:</strong> ${meeting.location}</p>`;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 20px; margin: 20px 0; }
        .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Invitation</h1>
        </div>
        <div class="content">
          <h2>${meeting.title}</h2>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          ${meeting.duration ? `<p><strong>Duration:</strong> ${meeting.duration} minutes</p>` : ''}
          ${locationInfo}
          ${meeting.description ? `<p><strong>Description:</strong><br>${meeting.description}</p>` : ''}
          ${meeting.agenda ? `<p><strong>Agenda:</strong><br>${meeting.agenda}</p>` : ''}
          ${meeting.meeting_link ? `<a href="${meeting.meeting_link}" class="button">Join Meeting</a>` : ''}
        </div>
        <div class="footer">
          <p>IIChE Student Chapter - Amrita Vishwa Vidyapeetham</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendMeetingEmail(to: string, subject: string, html: string) {
    // In production, use Resend or your email service
    // For now, log the email
    console.log('Sending meeting email to:', to);
    console.log('Subject:', subject);

    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'IIChE AVVU <noreply@iiche-avvu.org>',
    //   to,
    //   subject,
    //   html,
    // });
}

// ============================================
// MEETING UPDATES
// ============================================

export async function updateMeeting(
    meetingId: string,
    updates: Partial<MeetingData>,
    updatedBy: string
) {
    const supabase = createClient();

    // Get current meeting
    const { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

    if (!meeting) throw new Error('Meeting not found');

    // Check permission
    if (meeting.created_by !== updatedBy) {
        throw new Error('Only meeting creator can update');
    }

    // Update meeting
    const { error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', meetingId);

    if (error) throw error;

    // Notify participants of changes
    await notifyMeetingUpdate(meetingId, meeting.participants);
}

export async function cancelMeeting(meetingId: string, cancelledBy: string, reason?: string) {
    const supabase = createClient();

    const { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

    if (!meeting) throw new Error('Meeting not found');

    // Delete meeting
    const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

    if (error) throw error;

    // Notify participants
    await notifyMeetingCancellation(meeting, reason);
}

async function notifyMeetingUpdate(meetingId: string, participantIds: string[]) {
    const supabase = createClient();

    for (const userId of participantIds) {
        await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Meeting Updated',
            message: 'A meeting you are invited to has been updated',
            type: 'meeting',
            related_id: meetingId,
        });
    }
}

async function notifyMeetingCancellation(meeting: any, reason?: string) {
    const supabase = createClient();

    for (const userId of meeting.participants) {
        await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Meeting Cancelled',
            message: `The meeting "${meeting.title}" has been cancelled${reason ? `: ${reason}` : ''}`,
            type: 'meeting',
            related_id: meeting.id,
        });
    }
}

// ============================================
// MEETING ATTENDANCE
// ============================================

export async function markAttendance(meetingId: string, userId: string, attended: boolean) {
    const supabase = createClient();

    const { error } = await supabase
        .from('meeting_participants')
        .update({ attended })
        .eq('meeting_id', meetingId)
        .eq('user_id', userId);

    if (error) throw error;
}

export async function addMeetingMinutes(meetingId: string, minutes: string, addedBy: string) {
    const supabase = createClient();

    const { data: meeting } = await supabase
        .from('meetings')
        .select('created_by')
        .eq('id', meetingId)
        .single();

    if (!meeting) throw new Error('Meeting not found');

    const { error } = await supabase
        .from('meetings')
        .update({ minutes })
        .eq('id', meetingId);

    if (error) throw error;
}

// ============================================
// MEETING QUERIES
// ============================================

export async function getUserMeetings(userId: string, upcoming: boolean = true) {
    const supabase = createClient();

    let query = supabase
        .from('meetings')
        .select(`
      *,
      creator:profiles!meetings_created_by_fkey(id, name),
      committee:committees(id, name)
    `)
        .contains('participants', [userId])
        .order('meeting_date', { ascending: true });

    if (upcoming) {
        query = query.gte('meeting_date', new Date().toISOString());
    } else {
        query = query.lt('meeting_date', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
}

export async function getCommitteeMeetings(committeeId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('meetings')
        .select(`
      *,
      creator:profiles!meetings_created_by_fkey(id, name)
    `)
        .eq('committee_id', committeeId)
        .order('meeting_date', { ascending: false });

    if (error) throw error;

    return data || [];
}

export async function getMeetingDetails(meetingId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('meetings')
        .select(`
      *,
      creator:profiles!meetings_created_by_fkey(id, name, email),
      committee:committees(id, name),
      meeting_participants(
        user_id,
        attended,
        profile:profiles(id, name, email, avatar_url)
      )
    `)
        .eq('id', meetingId)
        .single();

    if (error) throw error;

    return data;
}

// ============================================
// CALENDAR INTEGRATION
// ============================================

export function generateICalendar(meeting: any): string {
    const startDate = new Date(meeting.meeting_date);
    const endDate = new Date(startDate.getTime() + (meeting.duration || 60) * 60000);

    const formatDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//IIChE AVVU//Meeting//EN
BEGIN:VEVENT
UID:${meeting.id}@iiche-avvu.org
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${meeting.title}
DESCRIPTION:${meeting.description || ''}
LOCATION:${meeting.meeting_type === 'online' ? meeting.meeting_link : meeting.location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}
