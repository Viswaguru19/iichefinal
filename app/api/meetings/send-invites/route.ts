import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const { meetingId } = await request.json();
        const supabase = await createClient();

        // Get meeting details
        const { data: meeting } = await supabase
            .from('meetings')
            .select(`
        *,
        creator:created_by(name, email),
        committee:committee_id(name)
      `)
            .eq('id', meetingId)
            .single();

        if (!meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        // Get participants
        const { data: participants } = await supabase
            .from('meeting_participants')
            .select('profiles(name, email)')
            .eq('meeting_id', meetingId);

        if (!participants || participants.length === 0) {
            return NextResponse.json({ error: 'No participants found' }, { status: 400 });
        }

        const meetingDate = new Date(meeting.meeting_date);
        const meetingType = meeting.meeting_type === 'online' ? 'Online' : 'In-Person';
        const locationInfo = meeting.meeting_type === 'online'
            ? `Platform: ${meeting.platform?.replace(/_/g, ' ').toUpperCase()}\nLink: ${meeting.meeting_link}`
            : `Location: ${meeting.location}`;

        // Send emails to all participants
        const emailPromises = participants.map((p: any) => {
            const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Meeting Invitation</h2>
          <p>You have been invited to a meeting:</p>
          
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
            ${meeting.committee ? `<p><strong>Committee:</strong> ${meeting.committee.name}</p>` : ''}
          </div>
          
          ${meeting.meeting_type === 'online' && meeting.meeting_link ? `
            <a href="${meeting.meeting_link}" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin: 10px 0;">
              Join Meeting
            </a>
          ` : ''}
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Organized by: ${meeting.creator?.name}<br/>
            IIChE AVVU Student Chapter
          </p>
        </div>
      `;

            return resend.emails.send({
                from: 'IIChE AVVU <noreply@iiche-avvu.com>',
                to: p.profiles.email,
                subject: `Meeting Invitation: ${meeting.title}`,
                html: emailHtml
            });
        });

        await Promise.all(emailPromises);

        return NextResponse.json({
            success: true,
            message: `Invitations sent to ${participants.length} participants`
        });
    } catch (error: any) {
        console.error('Error sending meeting invites:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
