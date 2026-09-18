import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { sendMeetingInvitationEmails } from '@/lib/send-meeting-invites';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const userClient = await createClient();
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { meetingId, customEmails } = body;
        if (!meetingId || typeof meetingId !== 'string') {
            return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
        }

        const supabase = tryCreateAdminClient() ?? userClient;
        const result = await sendMeetingInvitationEmails(supabase, { meetingId, customEmails });

        if (result.error) {
            return NextResponse.json(
                { error: result.error, sentCount: result.sentCount, total: result.total },
                { status: result.status || 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message: result.message,
            sentCount: result.sentCount,
            total: result.total,
        });
    } catch (error: any) {
        console.error('Error sending meeting invites:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
