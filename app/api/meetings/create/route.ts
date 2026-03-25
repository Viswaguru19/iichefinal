import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

interface CreateMeetingRequest {
    title: string;
    description?: string;
    meeting_type: 'online' | 'offline';
    meeting_date: string;
    duration: number;
    location?: string;
    agenda?: string;
    audience_type: 'all_members' | 'executive_committee' | 'specific_committee' | 'general';
    committee_id?: string;
    access_type?: 'invite_only' | 'general';
    require_approval?: boolean;
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: CreateMeetingRequest = await request.json();

        // --- Validation ---
        if (!body.title || body.title.trim().length === 0) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        if (body.title.length > 200) {
            return NextResponse.json({ error: 'Title must be 200 characters or less' }, { status: 400 });
        }
        const meetingDate = new Date(body.meeting_date);
        if (isNaN(meetingDate.getTime()) || meetingDate <= new Date()) {
            return NextResponse.json({ error: 'Meeting date must be in the future' }, { status: 400 });
        }
        if (!body.duration || body.duration <= 0) {
            return NextResponse.json({ error: 'Duration must be a positive number' }, { status: 400 });
        }
        if (body.meeting_type === 'offline' && (!body.location || body.location.trim().length === 0)) {
            return NextResponse.json({ error: 'Location is required for in-person meetings' }, { status: 400 });
        }
        if (body.audience_type === 'specific_committee' && !body.committee_id) {
            return NextResponse.json({ error: 'Committee ID is required for specific committee audience' }, { status: 400 });
        }

        // --- Auto-generate meeting_link for online meetings ---
        let meeting_link: string | null = null;
        const room_id = nanoid();
        if (body.meeting_type === 'online') {
            const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || '';
            meeting_link = `${origin}/meet/${room_id}`;
        }

        // --- Resolve audience (skip for general meetings) ---
        let participantIds: string[] = [];
        if (body.audience_type === 'all_members') {
            const { data } = await supabase.from('profiles').select('id').eq('is_active', true);
            participantIds = data?.map((p: any) => p.id) || [];
        } else if (body.audience_type === 'executive_committee') {
            const { data } = await supabase.from('profiles').select('id').not('executive_role', 'is', null);
            participantIds = data?.map((p: any) => p.id) || [];
        } else if (body.audience_type === 'specific_committee' && body.committee_id) {
            const { data } = await supabase.from('committee_members').select('user_id').eq('committee_id', body.committee_id);
            participantIds = data?.map((m: any) => m.user_id) || [];
        }

        // --- Insert meeting record (only columns that exist in schema) ---
        const meetingRecord: Record<string, any> = {
            title: body.title.trim(),
            description: body.description || null,
            meeting_type: body.meeting_type,
            meeting_date: body.meeting_date,
            duration: body.duration,
            location: body.meeting_type === 'offline' ? body.location : null,
            meeting_link: meeting_link,
            committee_id: body.audience_type === 'specific_committee' ? body.committee_id : null,
            created_by: user.id,
            agenda: body.agenda || null,
            participants: participantIds,
            access_type: body.access_type || 'invite_only',
            require_approval: body.require_approval || false,
        };

        const { data: meeting, error: insertError } = await (supabase as any)
            .from('meetings')
            .insert(meetingRecord)
            .select()
            .single();

        if (insertError || !meeting) {
            console.error('Meeting insert error:', insertError);
            return NextResponse.json({ error: insertError?.message || 'Failed to create meeting' }, { status: 500 });
        }

        // --- Insert into meeting_participants ---
        if (participantIds.length > 0) {
            await supabase
                .from('meeting_participants')
                .insert(participantIds.map(uid => ({ meeting_id: meeting.id, user_id: uid })));
        }

        // --- Trigger email invitations ---
        try {
            const origin = request.headers.get('origin') || '';
            await fetch(`${origin}/api/meetings/send-invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId: meeting.id }),
            });
        } catch { /* Non-fatal */ }

        return NextResponse.json({ meeting, meeting_link, participantCount: participantIds.length });
    } catch (error: any) {
        console.error('Error creating meeting:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
