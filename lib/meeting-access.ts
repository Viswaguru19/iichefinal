import type { SupabaseClient } from '@supabase/supabase-js';

export interface AccessCheckResult {
    granted: boolean;
    reason: 'unauthenticated' | 'meeting_not_found' | 'not_participant' | 'pending_approval' | 'granted';
    meeting?: any;
    userId?: string;
}

/**
 * Check whether a user has access to a meeting room.
 * 
 * Access is granted when:
 *  - The user is authenticated
 *  - A meeting with the given room_id in its meeting_link exists
 *  - The meeting is "general" (anyone can join), OR
 *  - The user is the meeting creator, OR
 *  - The user is in the participants array or meeting_participants table
 */
export async function checkMeetingAccess(
    supabase: SupabaseClient,
    roomId: string,
): Promise<AccessCheckResult> {
    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { granted: false, reason: 'unauthenticated' };
    }

    // 2. Fetch meeting by matching room_id in meeting_link
    // The meeting_link format is: {origin}/meet/{roomId}
    const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .ilike('meeting_link', `%/meet/${roomId}`);

    const meetingData = meetings?.[0];
    if (!meetingData) {
        return { granted: false, reason: 'meeting_not_found' };
    }

    // 3. General meetings — anyone authenticated can join
    if (meetingData.access_type === 'general') {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id };
    }

    // 4. Creator always has access
    if (meetingData.created_by === user.id) {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id };
    }

    // 5. Check participants UUID array (if it exists)
    if (meetingData.participants && Array.isArray(meetingData.participants)) {
        if (meetingData.participants.includes(user.id)) {
            return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id };
        }
    }

    // 6. Check meeting_participants table
    const { data: participant } = await supabase
        .from('meeting_participants')
        .select('id')
        .eq('meeting_id', meetingData.id)
        .eq('user_id', user.id)
        .single();

    if (participant) {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id };
    }

    // 7. EC members and faculty always have access
    const { data: profile } = await supabase
        .from('profiles')
        .select('executive_role, is_faculty, is_admin')
        .eq('id', user.id)
        .single();

    if (profile?.executive_role || profile?.is_faculty || profile?.is_admin) {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id };
    }

    // 8. If meeting requires approval, return pending
    if (meetingData.require_approval) {
        return { granted: false, reason: 'pending_approval', meeting: meetingData, userId: user.id };
    }

    return { granted: false, reason: 'not_participant' };
}
