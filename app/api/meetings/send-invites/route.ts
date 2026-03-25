import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/notifications';
import { buildMeetingNotificationEmail } from '@/lib/meeting-email-builder';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { meetingId, customEmails } = body;
        const supabase = await createClient();

        const { data: meeting } = await supabase
            .from('meetings')
            .select(`*, creator:created_by(name, email), committee:committee_id(name)`)
            .eq('id', meetingId)
            .single();

        if (!meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        const emailHtml = buildMeetingNotificationEmail(meeting as any);
        let sentCount = 0;
        const totalTargets: string[] = [];

        // Send to custom email addresses if provided
        if (customEmails && Array.isArray(customEmails) && customEmails.length > 0) {
            for (const email of customEmails) {
                if (!email || !email.includes('@')) continue;
                totalTargets.push(email);
                try {
                    await sendEmail(email.trim(), `Meeting Invitation: ${meeting.title}`, emailHtml);
                    sentCount++;
                } catch (err) {
                    console.error(`Failed to send invite to ${email}:`, err);
                }
            }
            return NextResponse.json({
                success: true,
                message: `Invitations sent to ${sentCount} of ${totalTargets.length} email(s)`,
            });
        }

        // Otherwise send to all meeting participants
        const { data: participants } = await supabase
            .from('meeting_participants')
            .select('profiles:user_id(name, email)')
            .eq('meeting_id', meetingId);

        if (!participants || participants.length === 0) {
            return NextResponse.json({ error: 'No participants found' }, { status: 400 });
        }

        for (const p of participants) {
            const profile = (p as any).profiles;
            if (!profile?.email) continue;
            try {
                await sendEmail(profile.email, `Meeting Invitation: ${meeting.title}`, emailHtml);
                sentCount++;
            } catch (err) {
                console.error(`Failed to send invite to ${profile.email}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Invitations sent to ${sentCount} of ${participants.length} participants`,
        });
    } catch (error: any) {
        console.error('Error sending meeting invites:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
