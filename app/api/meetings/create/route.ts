import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

/** Client may supply the same id shown in the schedule form so preview URL === saved meeting link. */
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;

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
    /** Optional portal room slug (nanoid). If missing or invalid, server generates one. */
    room_id?: string;
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
        const now = Date.now();
        // Small tolerance so a time chosen as "in a minute" is not rejected due to network delay.
        if (isNaN(meetingDate.getTime()) || meetingDate.getTime() < now - 10_000) {
            return NextResponse.json({ error: 'Meeting time must be in the future' }, { status: 400 });
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

        // --- Portal room slug + meeting_link (online only) — prefer client id so UI preview matches DB ---
        let meeting_link: string | null = null;
        let roomSlug: string | null = null;
        if (body.meeting_type === 'online') {
            const fromClient = typeof body.room_id === 'string' ? body.room_id.trim() : '';
            roomSlug = ROOM_ID_PATTERN.test(fromClient) ? fromClient : nanoid();
            const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || '';
            meeting_link = `${origin}/meet/${roomSlug}`;
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
            room_id: roomSlug,
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

        return NextResponse.json({
            meeting,
            meeting_link,
            room_id: roomSlug,
            participantCount: participantIds.length,
        });
    } catch (error: any) {
        console.error('Error creating meeting:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
