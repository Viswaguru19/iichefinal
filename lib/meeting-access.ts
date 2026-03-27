import type { SupabaseClient } from '@supabase/supabase-js';

export interface AccessCheckResult {
    granted: boolean;
    reason: 'unauthenticated' | 'meeting_not_found' | 'not_participant' | 'pending_approval' | 'granted' | 'guest_allowed';
    meeting?: any;
    userId?: string;
    userRole?: string | null;
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
    // 1. Authenticate (session fallback helps avoid false guest prompt)
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user || null;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const user = authUser || sessionUser;

    // 2. Fetch meeting by matching room_id in meeting_link
    const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .ilike('meeting_link', `%/meet/${roomId}`);

    const meetingData = meetings?.[0];
    if (!meetingData) {
        return { granted: false, reason: 'meeting_not_found' };
    }

    // 3. If not authenticated but meeting is general, allow as guest
    if (!user) {
        if (meetingData.access_type === 'general') {
            return { granted: false, reason: 'guest_allowed', meeting: meetingData };
        }
        return { granted: false, reason: 'unauthenticated' };
    }

    // 4. Fetch user profile for role info
    const { data: profile } = await supabase
        .from('profiles')
        .select('executive_role, is_faculty, is_admin, name')
        .eq('id', user.id)
        .single();

    let userRole: string | null = null;
    if (profile?.is_faculty) userRole = 'Faculty';
    else if (profile?.is_admin) userRole = 'Admin';
    else if (profile?.executive_role) userRole = profile.executive_role.replace(/_/g, ' ');

    const isPrivileged = !!(profile?.executive_role || profile?.is_faculty || profile?.is_admin);

    // 5. General meetings — anyone authenticated can join unless approval is required
    if (meetingData.access_type === 'general' && !meetingData.require_approval) {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id, userRole };
    }

    // 6. Creator always has access
    if (meetingData.created_by === user.id) {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id, userRole };
    }

    // 7. Check participants UUID array
    if (meetingData.participants && Array.isArray(meetingData.participants)) {
        if (meetingData.participants.includes(user.id)) {
            return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id, userRole };
        }
    }

    // 8. Check meeting_participants table
    const { data: participant } = await supabase
        .from('meeting_participants')
        .select('id, rsvp_status')
        .eq('meeting_id', meetingData.id)
        .eq('user_id', user.id)
        .single();

    if (participant && (meetingData.access_type !== 'general' || !meetingData.require_approval || participant.rsvp_status === 'approved')) {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id, userRole };
    }

    // 9. EC members and faculty always have access
    if (isPrivileged) {
        return { granted: true, reason: 'granted', meeting: meetingData, userId: user.id, userRole };
    }

    // 10. If general meeting requires approval, return pending for regular users
    if (meetingData.access_type === 'general' && meetingData.require_approval) {
        return { granted: false, reason: 'pending_approval', meeting: meetingData, userId: user.id };
    }

    return { granted: false, reason: 'not_participant' };
}
