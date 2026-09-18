import { createClient } from '@/lib/supabase/server';
import { sendMeetingInvitationEmails } from '@/lib/send-meeting-invites';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { meetingId, customEmails } = body;
        const supabase = await createClient();

        const result = await sendMeetingInvitationEmails(supabase, { meetingId, customEmails });

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status || 500 });
        }

        return NextResponse.json({
            success: true,
            message: result.message,
        });
    } catch (error: any) {
        console.error('Error sending meeting invites:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
