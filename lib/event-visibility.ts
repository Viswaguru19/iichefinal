import { createClient } from '@/lib/supabase/client';

/**
 * Check if an event should be visible to a user based on workflow config
 * 
 * Rules:
 * 1. Proposing committee always sees their events
 * 2. EC members always see all events
 * 3. Admins always see all events
 * 4. Other committees see events based on visibility_to_other_committees setting:
 *    - 'once_proposed': See all events immediately
 *    - 'after_head_approval': See events after head approves (pending_ec_approval or active)
 *    - 'after_active': See only active events
 */
export async function isEventVisibleToUser(
    event: any,
    userProfile: any,
    userCommittees: string[]
): Promise<boolean> {
    // Admin always sees everything
    if (userProfile?.is_admin || userProfile?.role === 'super_admin') {
        return true;
    }

    // EC members always see everything
    if (userProfile?.executive_role !== null) {
        return true;
    }

    // Proposing committee always sees their own events
    if (userCommittees.includes(event.committee_id)) {
        return true;
    }

    // For other committees, check visibility setting
    const supabase = createClient();
    const { data: config } = await supabase
        .from('workflow_config')
        .select('config')
        .eq('workflow_type', 'event_visibility')
        .single();

    const visibilitySetting = config?.config?.visibility_to_other_committees || 'after_active';

    switch (visibilitySetting) {
        case 'once_proposed':
            // See all events at any status
            return true;

        case 'after_head_approval':
            // See events after head approval
            return event.status === 'pending_ec_approval' || event.status === 'active';

        case 'after_active':
            // See only active events
            return event.status === 'active';

        default:
            return false;
    }
}

/**
 * Filter events array based on visibility rules
 */
export async function filterVisibleEvents(
    events: any[],
    userProfile: any,
    userCommittees: string[]
): Promise<any[]> {
    const visibilityChecks = await Promise.all(
        events.map(event => isEventVisibleToUser(event, userProfile, userCommittees))
    );

    return events.filter((_, index) => visibilityChecks[index]);
}
