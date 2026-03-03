import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const now = new Date();
        const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        // Get meetings in the next 24 hours
        const { data: upcomingMeetings } = await supabase
            .from('meetings')
            .select(`
        *,
        creator:created_by(name),
        committee:committee_id(name),
        participants:meeting_participants(profiles(name, email))
      `)
            .gte('meeting_date', now.toISOString())
            .lte('meeting_date', twentyFourHoursLater.toISOString());

        if (!upcomingMeetings || upcomingMeetings.length === 0) {
            return NextResponse.json({ message: 'No upcoming meetings' });
        }

        let remindersSent = 0;

        for (const meeting of upcomingMeetings) {
            const meetingDate = new Date(meeting.meeting_date);
            const hoursUntilMeeting = (meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

            // Send 24-hour reminder
            if (hoursUntilMeeting <= 24 && hoursUntilMeeting > 23) {
                await sendReminder(meeting, '24 hours');
                remindersSent++;
            }

            // Send 1-hour reminder
            if (hoursUntilMeeting <= 1 && hoursUntilMeeting > 0.5) {
                await sendReminder(meeting, '1 hour');
                remindersSent++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sent ${remindersSent} reminders`
        });
    } catch (error: any) {
        console.error('Error sending reminders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function sendReminder(meeting: any, timeframe: string) {
    const meetingDate = new Date(meeting.meeting_date);
    const meetingType = meeting.meeting_type === 'online' ? 'Online' : 'In-Person';
    const locationInfo = meeting.meeting_type === 'online'
        ? `Platform: ${meeting.platform?.replace(/_/g, ' ').toUpperCase()}\nLink: ${meeting.meeting_link}`
        : `Location: ${meeting.location}`;

    const participants = meeting.participants || [];

    const emailPromises = participants.map((p: any) => {
        const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px;">
          <h2 style="color: #92400e; margin: 0;">⏰ Meeting Reminder</h2>
          <p style="color: #92400e; margin: 8px 0 0 0;">Your meeting starts in ${timeframe}</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${meeting.title}</h3>
          ${meeting.description ? `<p>${meeting.description}</p>` : ''}
          
          <p><strong>Date & Time:</strong> ${meetingDate.toLocaleString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</p>
          
          <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
          <p><strong>Type:</strong> ${meetingType}</p>
          <p style="white-space: pre-line;"><strong>${meeting.meeting_type === 'online' ? 'Meeting Details' : 'Location'}:</strong>\n${locationInfo}</p>
          
          ${meeting.agenda ? `<p><strong>Agenda:</strong><br/>${meeting.agenda}</p>` : ''}
        </div>
        
        ${meeting.meeting_type === 'online' && meeting.meeting_link ? `
          <a href="${meeting.meeting_link}" 
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin: 10px 0;">
            Join Meeting Now
          </a>
        ` : ''}
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          IIChE AVVU Student Chapter
        </p>
      </div>
    `;

        return resend.emails.send({
            from: 'IIChE AVVU <noreply@iiche-avvu.com>',
            to: p.profiles.email,
            subject: `Reminder: ${meeting.title} starts in ${timeframe}`,
            html: emailHtml
        });
    });

    await Promise.all(emailPromises);
}

// This can be called by a cron job
export async function GET() {
    return POST(new Request('http://localhost'));
}
