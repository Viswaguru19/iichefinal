import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { sendMeetingInvitationEmails } from '@/lib/send-meeting-invites';
import { isCoHeadPosition, isHeadPosition } from '@/lib/committee-positions';

/** Client may supply the same id shown in the schedule form so preview URL === saved meeting link. */
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;

type AudienceType =
    | 'all_members'
    | 'executive_committee'
    | 'heads_only'
    | 'coheads_only'
    | 'specific_committee'
    | 'general';

interface CreateMeetingRequest {
    title: string;
    description?: string;
    meeting_type: 'online' | 'offline';
    meeting_date: string;
    duration: number;
    location?: string;
    agenda?: string;
    audience_type: AudienceType;
    committee_id?: string;
    access_type?: 'invite_only' | 'general';
    require_approval?: boolean;
    /** Optional portal room slug (nanoid). If missing or invalid, server generates one. */
    room_id?: string;
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
    return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/** Prefer service role so RLS cannot hide co-heads on other committees. */
function directoryClient(userClient: any) {
    return tryCreateAdminClient() ?? userClient;
}

async function userIdsByCommitteePosition(
    db: any,
    predicate: (position: string | null | undefined) => boolean,
): Promise<string[]> {
    const { data } = await db.from('committee_members').select('user_id, position');
    return uniqueIds(
        (data || [])
            .filter((m: any) => predicate(m.position))
            .map((m: any) => m.user_id),
    );
}

async function userIdsInChatType(db: any, chatType: string): Promise<string[]> {
    const { data: groups } = await db.from('chat_groups').select('id').eq('chat_type', chatType);
    const groupIds = uniqueIds((groups || []).map((g: any) => g.id));
    if (groupIds.length === 0) return [];
    const { data: parts } = await db.from('chat_participants').select('user_id').in('group_id', groupIds);
    return uniqueIds((parts || []).map((p: any) => p.user_id));
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

        // Directory reads/writes bypass RLS when the service role is configured.
        const directory = directoryClient(supabase);

        // --- Resolve audience (skip for general meetings) ---
        let participantIds: string[] = [];
        if (body.audience_type === 'all_members') {
            const { data } = await directory.from('profiles').select('id').eq('is_active', true);
            participantIds = data?.map((p: any) => p.id) || [];
        } else if (body.audience_type === 'executive_committee') {
            const { data } = await directory.from('profiles').select('id').not('executive_role', 'is', null);
            participantIds = data?.map((p: any) => p.id) || [];
        } else if (body.audience_type === 'heads_only') {
            const fromMembers = await userIdsByCommitteePosition(directory, isHeadPosition);
            const { data: byRole } = await directory
                .from('profiles')
                .select('id')
                .eq('role', 'committee_head');
            const fromChat = await userIdsInChatType(directory, 'heads');
            participantIds = uniqueIds([
                ...fromMembers,
                ...(byRole || []).map((p: any) => p.id),
                ...fromChat,
            ]);
        } else if (body.audience_type === 'coheads_only') {
            const fromMembers = await userIdsByCommitteePosition(directory, isCoHeadPosition);
            const { data: byRole } = await directory
                .from('profiles')
                .select('id')
                .eq('role', 'committee_cohead');
            const fromChat = await userIdsInChatType(directory, 'coheads');
            participantIds = uniqueIds([
                ...fromMembers,
                ...(byRole || []).map((p: any) => p.id),
                ...fromChat,
            ]);
        } else if (body.audience_type === 'specific_committee' && body.committee_id) {
            const { data } = await directory.from('committee_members').select('user_id').eq('committee_id', body.committee_id);
            participantIds = data?.map((m: any) => m.user_id) || [];
        }

        // Faculty coordinators always receive every meeting (online and offline).
        const { data: facultyRows } = await directory
            .from('profiles')
            .select('id')
            .or('is_faculty.eq.true,role.eq.faculty_advisor');
        participantIds = uniqueIds([
            ...participantIds,
            ...(facultyRows || []).map((p: any) => p.id),
        ]);

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
            audience_type: body.audience_type,
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
            const { error: participantError } = await directory
                .from('meeting_participants')
                .insert(participantIds.map(uid => ({ meeting_id: meeting.id, user_id: uid })));
            if (participantError) {
                console.error('Meeting participants insert error:', participantError);
            }
        }

        // --- Email invitations (online and offline: time, place, agenda) ---
        if (participantIds.length > 0) {
            try {
                await sendMeetingInvitationEmails(directory, { meetingId: meeting.id });
            } catch (err) {
                console.error('Failed to send meeting invitations:', err);
            }
        }

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
