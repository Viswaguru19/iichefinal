// ============================================
// APPROVAL WORKFLOW UTILITIES
// Handles all approval processes with logging
// ============================================

import { createClient } from '@/lib/supabase/client';
import { dispatchPushForNotifications, insertPortalNotifications } from '@/lib/portal-notifications-client';
import {
    notifyEC,
    notifyFaculty,
    notifyEventProposer,
    notifyCommitteeHeads,
    notifyCommittee,
    notifyUsers,
} from '@/lib/portal-notify-helpers';
import type { UserRole, EventStatus, TaskStatus, ApprovalStatus, FinanceApprovalStatus } from '@/types/database';

interface ApprovalContext {
    userId: string;
    userRole: UserRole;
    entityType: 'event' | 'task' | 'poster' | 'email' | 'kickoff' | 'finance' | 'schedule';
    entityId: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    reason?: string;
    metadata?: any;
}

// ============================================
// CORE APPROVAL LOGGING
// ============================================

/**
 * Logs an approval action to the approval_logs table for audit purposes.
 * 
 * All approval-related actions (propose, approve, reject, status changes) must
 * be logged to maintain a complete audit trail. This function is called internally
 * by all approval workflow functions.
 * 
 * @param context - Approval context containing:
 *   - userId: UUID of user performing action
 *   - userRole: Role of the user
 *   - entityType: Type of entity ('event', 'task', 'poster', 'email', etc.)
 *   - entityId: UUID of the entity
 *   - action: Action performed (e.g., 'approve_as_ec', 'reject_event')
 *   - previousStatus: Status before action
 *   - newStatus: Status after action
 *   - reason: Optional reason (required for rejections)
 *   - metadata: Optional additional data
 * 
 * @throws Error if database insert fails
 */
export async function logApproval(context: ApprovalContext) {
    const supabase = createClient();

    const { error } = await supabase.from('approval_logs').insert({
        user_id: context.userId,
        user_role: context.userRole,
        action: context.action,
        entity_type: context.entityType,
        entity_id: context.entityId,
        previous_status: context.previousStatus,
        new_status: context.newStatus,
        reason: context.reason,
        metadata: context.metadata,
    });

    if (error) {
        console.error('Failed to log approval:', error);
        throw new Error('Failed to log approval action');
    }
}

// ============================================
// EVENT APPROVAL WORKFLOW
// ============================================

/**
 * Creates a new event proposal with 'pending_head_approval' status.
 * 
 * This is the first step in the event approval workflow. The event will be
 * visible to committee heads and EC members (read-only for EC until head approves).
 * 
 * @param eventData - Event details (title, description, date, location, budget, etc.)
 * @param userId - UUID of user proposing the event
 * @param userRole - Role of the user
 * 
 * @returns Created event object
 * 
 * @throws Error if database operation fails
 */
export async function proposeEvent(eventData: any, userId: string, userRole: UserRole) {
    const supabase = createClient();

    // Create event with draft status
    const { data: event, error } = await supabase
        .from('events')
        .insert({
            ...eventData,
            status: 'pending_head_approval',
            proposed_by: userId,
            created_by: userId,
        })
        .select()
        .single();

    if (error) throw error;

    // Log the proposal
    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: event.id,
        action: 'propose_event',
        previousStatus: 'none',
        newStatus: 'pending_head_approval',
    });

    return event;
}

/**
 * Approves an event as a committee head, transitioning it to EC approval stage.
 * 
 * After head approval, the event moves to 'pending_ec_approval' status where
 * EC members can approve (1 out of 6 required). EC members can view the event
 * in read-only mode before head approval.
 * 
 * @param eventId - UUID of the event to approve
 * @param userId - UUID of the committee head approving
 * @param userRole - Role of the user
 * 
 * @throws Error if:
 *   - Event not found
 *   - Event is not at 'pending_head_approval' status
 *   - Database operation fails
 */
export async function approveEventAsHead(eventId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    // Get current event
    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');
    if (event.status !== 'pending_head_approval') {
        throw new Error('Event is not at the correct approval stage');
    }

    // Update to pending EC approval
    const { error } = await supabase
        .from('events')
        .update({
            status: 'pending_ec_approval',
            head_approved_by: userId,
            head_approved_at: new Date().toISOString(),
        })
        .eq('id', eventId);

    if (error) throw error;

    // Log approval
    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: 'approve_as_head',
        previousStatus: event.status,
        newStatus: 'pending_ec_approval',
    });

    await notifyEC(supabase, {
        type: 'proposal',
        title: 'Proposal needs EC approval',
        message: `"${event.title}" was approved by the committee head and needs EC review.`,
        link: `/dashboard/proposals`,
        related_id: eventId,
    });
}

// ============================================
// EC APPROVAL FOR EVENTS (1/6 threshold)
// ============================================

/**
 * Approves an event as an Executive Committee (EC) member.
 * 
 * **Approval Threshold**: Only 1 out of 6 EC members needs to approve for an event
 * to be approved and move to event progress. This threshold was chosen for operational
 * efficiency, allowing events to move forward quickly after head approval.
 * 
 * **Workflow**:
 * 1. Validates user has EC role (executive_role field must be set)
 * 2. Verifies event is at 'pending_ec_approval' status
 * 3. Records individual EC member's approval in ec_approvals table (upserts to handle duplicates)
 * 4. Immediately transitions event to 'approved' status (single approval sufficient)
 * 5. Event becomes visible in Event Progress section
 * 
 * @param eventId - UUID of the event to approve
 * @param userId - UUID of the EC member approving
 * @param userRole - Role of the user (must have EC permissions)
 * 
 * @returns Object containing:
 *   - approvalCount: Current number of EC approvals (will be 1)
 *   - thresholdReached: Boolean indicating approval achieved (always true)
 * 
 * @throws Error if:
 *   - User does not have EC approval permissions
 *   - Event not found
 *   - Event is not at 'pending_ec_approval' status
 *   - Database operation fails
 * 
 * @example
 * ```typescript
 * const result = await approveEventAsEC(
 *   'event-uuid',
 *   'user-uuid',
 *   'executive_committee'
 * );
 * // result: { approvalCount: 1, thresholdReached: true }
 * ```
 */
export async function approveEventAsEC(eventId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    // Validate user has EC role
    const { data: profile } = await supabase
        .from('profiles')
        .select('executive_role')
        .eq('id', userId)
        .single();

    if (!profile?.executive_role) {
        throw new Error('User does not have EC approval permissions');
    }

    // Get current event
    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');
    if (event.status !== 'pending_ec_approval') {
        throw new Error('Event is not at the correct approval stage');
    }

    // Record EC member's approval (upsert to handle duplicate approvals)
    const { error: approvalError } = await supabase
        .from('ec_approvals')
        .upsert({
            event_id: eventId,
            user_id: userId,
            approved: true,
            approved_at: new Date().toISOString(),
        }, {
            onConflict: 'event_id,user_id'
        });

    if (approvalError) throw approvalError;

    // Single EC approval is sufficient - move to faculty approval
    const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'pending_faculty_approval' })
        .eq('id', eventId);

    if (updateError) throw updateError;

    // Log approval
    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: 'approve_as_ec',
        previousStatus: event.status,
        newStatus: 'pending_faculty_approval',
        metadata: { approvalCount: 1, threshold: 1, note: 'Single EC approval sufficient, moving to faculty' },
    });

    await notifyFaculty(supabase, {
        type: 'proposal',
        title: 'Proposal needs faculty approval',
        message: `"${event.title}" was EC-approved and needs faculty approval.`,
        link: `/dashboard/proposals`,
        related_id: eventId,
    });

    return { approvalCount: 1, thresholdReached: true };
}

/**
 * Sends a notification to the proposing committee when their event is approved.
 * 
 * Creates a notification for the user who proposed the event, informing them
 * that their event has been approved by the EC and is now active.
 * 
 * @param eventId - UUID of the approved event
 * @param proposedBy - UUID of the user who proposed the event
 * @param committeeId - UUID of the committee that proposed the event
 */
async function sendEventApprovalNotification(
    eventId: string,
    proposedBy: string,
    committeeId: string
) {
    const supabase = createClient();

    // Get event details
    const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('id', eventId)
        .single();

    if (!event) return;

    // Create notification for the proposer
    const row = {
        user_id: proposedBy,
        type: 'event_approved',
        title: 'Event Approved! 🎉',
        message: `Your event "${event.title}" has been approved by the Executive Committee and is now active. You can start assigning tasks in Event Progress.`,
        link: `/dashboard/events/progress`,
    };

    const { error } = await supabase.from('notifications').insert({
        ...row,
        metadata: {
            event_id: eventId,
            committee_id: committeeId,
        },
    });

    if (error) {
        console.error('Failed to send approval notification:', error);
    } else {
        void dispatchPushForNotifications([row]);
    }
}

/**
 * Approves an event as a faculty advisor, transitioning it to active status.
 * 
 * This is the final approval stage in the event workflow. After faculty approval,
 * the event becomes active and visible to all users, and tasks can be assigned.
 * 
 * **Prerequisites**: Event must be at 'pending_faculty_approval' status, which
 * means it has already received head approval and 2+ EC approvals.
 * 
 * @param eventId - UUID of the event to approve
 * @param userId - UUID of the faculty member approving
 * @param userRole - Role of the user (must have faculty or admin permissions)
 * 
 * @throws Error if:
 *   - User does not have faculty approval permissions
 *   - Event not found
 *   - Event is not at 'pending_faculty_approval' status
 *   - Database operation fails
 * 
 * @example
 * ```typescript
 * await approveEventAsFaculty('event-uuid', 'faculty-uuid', 'faculty');
 * ```
 */
export async function approveEventAsFaculty(eventId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    // Validate user has faculty permissions
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_faculty, is_admin')
        .eq('id', userId)
        .single();

    if (!profile?.is_faculty && !profile?.is_admin) {
        throw new Error('User does not have faculty approval permissions');
    }

    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');
    if (event.status !== 'pending_faculty_approval') {
        throw new Error('Event is not at the correct approval stage');
    }

    // Update to active
    const { error } = await supabase
        .from('events')
        .update({
            status: 'active',
            faculty_approved_by: userId,
            faculty_approved_at: new Date().toISOString(),
        })
        .eq('id', eventId);

    if (error) throw error;

    // Log approval
    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: 'approve_as_faculty',
        previousStatus: event.status,
        newStatus: 'active',
    });

    await notifyEventProposer(supabase, eventId, {
        type: 'proposal',
        title: 'Event approved and active',
        message: `"${event.title}" is now active. You can manage tasks and participants.`,
        link: `/dashboard/event-detail/${eventId}`,
        related_id: eventId,
    });
}

/**
 * Rejects an event at any approval stage.
 * 
 * Rejection transitions the event to 'cancelled' status and requires a non-empty
 * reason that will be visible to the proposing committee.
 * 
 * @param eventId - UUID of the event to reject
 * @param userId - UUID of the user rejecting
 * @param userRole - Role of the user
 * @param reason - Required explanation for rejection (must be non-empty)
 * 
 * @throws Error if:
 *   - Rejection reason is empty or whitespace-only
 *   - Event not found
 *   - Database operation fails
 * 
 * @example
 * ```typescript
 * await rejectEvent(
 *   'event-uuid',
 *   'user-uuid',
 *   'faculty',
 *   'Budget exceeds allocated funds for this quarter'
 * );
 * ```
 */
export async function rejectEvent(
    eventId: string,
    userId: string,
    userRole: UserRole,
    reason: string
) {
    const supabase = createClient();

    if (!reason || reason.trim().length === 0) {
        throw new Error('Rejection reason is required');
    }

    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');

    const { error } = await supabase
        .from('events')
        .update({
            status: 'cancelled',
            rejection_reason: reason
        })
        .eq('id', eventId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: 'reject_event',
        previousStatus: event.status,
        newStatus: 'cancelled',
        reason,
    });
}

// ============================================
// SEND FOR REVIEW
// ============================================

export async function sendEventForReview(
    eventId: string,
    userId: string,
    userRole: UserRole,
    targetRole: 'cohead' | 'head' | 'ec',
    note?: string
) {
    const supabase = createClient();

    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');

    const statusMap: Record<string, string> = {
        cohead: 'review_by_cohead',
        head: 'pending_head_approval',
        ec: 'pending_ec_approval',
    };

    const newStatus = statusMap[targetRole];

    const { error } = await supabase
        .from('events')
        .update({
            status: newStatus,
            review_note: note || null,
            review_sent_by: userId,
            review_sent_at: new Date().toISOString(),
        })
        .eq('id', eventId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: `send_for_review_${targetRole}`,
        previousStatus: event.status,
        newStatus,
        reason: note,
    });

    const reviewPayload = {
        type: 'proposal',
        title: 'Proposal sent for review',
        message: `"${event.title}" was sent for your review${note ? `: ${note}` : '.'}`,
        link: `/dashboard/proposals`,
        related_id: eventId,
    };

    if (targetRole === 'ec') {
        await notifyEC(supabase, reviewPayload);
    } else if (event.committee_id) {
        await notifyCommitteeHeads(supabase, event.committee_id, reviewPayload);
    }
}

// ============================================
// REVOKE (EC or Faculty can revoke a rejection)
// ============================================

export async function revokeEventRejection(
    eventId: string,
    userId: string,
    userRole: UserRole,
    restoreToStatus: string,
    note?: string
) {
    const supabase = createClient();

    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');

    const { error } = await supabase
        .from('events')
        .update({
            status: restoreToStatus,
            rejection_reason: null,
            review_note: note || null,
        })
        .eq('id', eventId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: 'revoke_rejection',
        previousStatus: event.status,
        newStatus: restoreToStatus,
        reason: note,
    });
}

// ============================================
// CANCEL EVENT (EC or Faculty, any time)
// ============================================

export async function cancelEvent(
    eventId: string,
    userId: string,
    userRole: UserRole,
    reason: string
) {
    const supabase = createClient();

    if (!reason || reason.trim().length === 0) {
        throw new Error('Cancellation reason is required');
    }

    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');

    const { error } = await supabase
        .from('events')
        .update({
            status: 'cancelled',
            rejection_reason: reason,
            cancelled_by: userId,
            cancelled_at: new Date().toISOString(),
        })
        .eq('id', eventId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: 'cancel_event',
        previousStatus: event.status,
        newStatus: 'cancelled',
        reason,
    });
}

// ============================================
// CHANGE EVENT DATE (EC, Faculty, or proposing committee)
// ============================================

export async function changeEventDate(
    eventId: string,
    userId: string,
    userRole: UserRole,
    newDate: string,
    reason?: string
) {
    const supabase = createClient();

    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');

    const oldDate = event.date || event.event_date;

    const { error } = await supabase
        .from('events')
        .update({
            date: newDate,
            event_date: newDate,
        })
        .eq('id', eventId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'event',
        entityId: eventId,
        action: 'change_date',
        previousStatus: oldDate,
        newStatus: newDate,
        reason,
    });
}

// ============================================
// TASK APPROVAL WORKFLOW (1/6 EC threshold)
// ============================================

/**
 * Creates a new task for an active event.
 * 
 * Tasks are created with 'pending_ec_approval' status and require EC approval
 * before being assigned to committees. This ensures EC oversight of all task
 * assignments across committees.
 * 
 * @param taskData - Task details (event_id, assigned_to_committee_id, title, description, etc.)
 * @param userId - UUID of user creating the task
 * @param userRole - Role of the user
 * 
 * @returns Created task object
 * 
 * @throws Error if database operation fails
 */
export async function createTask(taskData: any, userId: string, userRole: UserRole) {
    const supabase = createClient();

    const { data: task, error } = await supabase
        .from('tasks')
        .insert({
            ...taskData,
            status: 'pending_ec_approval',
            created_by: userId,
        })
        .select()
        .single();

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'task',
        entityId: task.id,
        action: 'create_task',
        previousStatus: 'none',
        newStatus: 'pending_ec_approval',
    });

    return task;
}

/**
 * Approves a task as an Executive Committee (EC) member.
 * 
 * **Approval Threshold**: Only 1 out of 6 EC members needs to approve for a task
 * to be assigned to a committee. This lower threshold (compared to events) enables
 * faster task assignment while maintaining EC oversight. The rationale is that tasks
 * are lower-stakes than full events and need to move quickly for operational efficiency.
 * 
 * **Workflow**:
 * 1. Validates user has EC role (executive_role field must be set)
 * 2. Verifies task is at 'pending_ec_approval' status
 * 3. Immediately transitions task to 'not_started' (single approval sufficient)
 * 4. Records EC approver ID and timestamp
 * 5. Sends notifications to all members of the assigned committee
 * 6. Optionally applies modifications to task fields
 * 
 * @param taskId - UUID of the task to approve
 * @param userId - UUID of the EC member approving
 * @param userRole - Role of the user (must have EC permissions)
 * @param modifications - Optional object with field modifications to apply
 * 
 * @throws Error if:
 *   - User does not have EC approval permissions
 *   - Task not found
 *   - Task is not at 'pending_ec_approval' status
 *   - Database operation fails
 * 
 * @example
 * ```typescript
 * // Simple approval
 * await approveTaskAsEC('task-uuid', 'user-uuid', 'executive_committee');
 * 
 * // Approval with modifications
 * await approveTaskAsEC(
 *   'task-uuid',
 *   'user-uuid',
 *   'executive_committee',
 *   { deadline: '2024-12-31', priority: 'high' }
 * );
 * ```
 */
export async function approveTaskAsEC(
    taskId: string,
    userId: string,
    userRole: UserRole,
    modifications?: any
) {
    const supabase = createClient();

    // Validate user has EC role
    const { data: profile } = await supabase
        .from('profiles')
        .select('executive_role')
        .eq('id', userId)
        .single();

    if (!profile?.executive_role) {
        throw new Error('User does not have EC approval permissions');
    }

    const { data: task } = await supabase
        .from('tasks')
        .select('*, event:event_id(title), committee:assigned_to_committee_id(name)')
        .eq('id', taskId)
        .single();

    if (!task) throw new Error('Task not found');
    if (task.status !== 'pending_ec_approval') {
        throw new Error('Task is not pending EC approval');
    }

    const updateData: any = {
        status: 'not_started',
        ec_approved_by: userId,
        ec_approved_at: new Date().toISOString(),
    };

    // Apply modifications if provided
    if (modifications) {
        Object.assign(updateData, modifications);
        updateData.ec_modified_fields = modifications;
    }

    // Single EC approval is sufficient - update task immediately
    const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'task',
        entityId: taskId,
        action: 'approve_task',
        previousStatus: task.status,
        newStatus: 'not_started',
        metadata: { modifications, threshold: 1, note: 'Single EC approval sufficient' },
    });

    // Send notifications to all members of the assigned committee
    await sendTaskAssignmentNotifications(taskId, task.assigned_to_committee_id, task.event, task.committee);
}

/**
 * Sends notifications to all members of a committee when a task is assigned to them.
 * 
 * Creates individual notifications for each committee member, informing them
 * of the new task assignment. This ensures everyone in the committee is aware
 * of their responsibilities.
 * 
 * @param taskId - UUID of the approved task
 * @param committeeId - UUID of the committee the task is assigned to
 * @param event - Event object containing event details
 * @param committee - Committee object containing committee details
 */
async function sendTaskAssignmentNotifications(
    taskId: string,
    committeeId: string,
    event: any,
    committee: any
) {
    const supabase = createClient();

    // Get task details
    const { data: task } = await supabase
        .from('tasks')
        .select('title, description')
        .eq('id', taskId)
        .single();

    if (!task) return;

    // Get all members of the assigned committee
    const { data: members } = await supabase
        .from('committee_members')
        .select('user_id')
        .eq('committee_id', committeeId);

    if (!members || members.length === 0) return;

    // Create notifications for all committee members
    const notifications = members.map(member => ({
        user_id: member.user_id,
        type: 'task_assigned',
        title: 'New Task Assigned! 📋',
        message: `Your committee "${committee?.name}" has been assigned a new task: "${task.title}" for the event "${event?.title}". Check your tasks section for details.`,
        link: `/dashboard/tasks`,
        metadata: {
            task_id: taskId,
            event_id: event?.id,
            committee_id: committeeId,
        },
    }));

    const { error } = await supabase
        .from('notifications')
        .insert(notifications);

    if (error) {
        console.error('Failed to send task assignment notifications:', error);
    } else {
        void dispatchPushForNotifications(notifications);
    }
}

/**
 * Rejects a task as an Executive Committee (EC) member.
 * 
 * Rejected tasks are marked with 'ec_rejected' status and excluded from
 * progress calculations. The rejection reason is stored for the proposing committee.
 * 
 * @param taskId - UUID of the task to reject
 * @param userId - UUID of the EC member rejecting
 * @param userRole - Role of the user
 * @param reason - Explanation for rejection
 * 
 * @throws Error if:
 *   - Task not found
 *   - Database operation fails
 */
export async function rejectTaskAsEC(
    taskId: string,
    userId: string,
    userRole: UserRole,
    reason: string
) {
    const supabase = createClient();

    const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

    if (!task) throw new Error('Task not found');

    const { error } = await supabase
        .from('tasks')
        .update({
            status: 'ec_rejected',
            ec_rejection_reason: reason,
        })
        .eq('id', taskId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'task',
        entityId: taskId,
        action: 'reject_task',
        previousStatus: task.status,
        newStatus: 'ec_rejected',
        reason,
    });
}

/**
 * Updates a task's status and optionally adds an update with documents.
 * 
 * Used by committee members to track task progress through the workflow:
 * not_started → in_progress → completed
 * 
 * @param taskId - UUID of the task to update
 * @param newStatus - New status to set
 * @param userId - UUID of user making the update
 * @param userRole - Role of the user
 * @param updateText - Optional text update describing progress
 * @param documents - Optional array of document attachments
 * 
 * @throws Error if:
 *   - Task not found
 *   - Database operation fails
 * 
 * @example
 * ```typescript
 * await updateTaskStatus(
 *   'task-uuid',
 *   'in_progress',
 *   'user-uuid',
 *   'committee_member',
 *   'Started working on venue booking',
 *   []
 * );
 * ```
 */
export async function updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    userId: string,
    userRole: UserRole,
    updateText?: string,
    documents?: any[]
) {
    const supabase = createClient();

    const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

    if (!task) throw new Error('Task not found');

    // Update task status
    const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

    if (taskError) throw taskError;

    // Add task update
    if (updateText) {
        const { error: updateError } = await supabase
            .from('task_updates')
            .insert({
                task_id: taskId,
                user_id: userId,
                update_text: updateText,
                status_change: newStatus,
                documents: documents || [],
            });

        if (updateError) throw updateError;
    }

    await logApproval({
        userId,
        userRole,
        entityType: 'task',
        entityId: taskId,
        action: 'update_status',
        previousStatus: task.status,
        newStatus,
    });
}

// ============================================
// PR EMAIL APPROVAL WORKFLOW
// ============================================

export async function draftPREmail(emailData: any, userId: string, userRole: UserRole) {
    const supabase = createClient();

    const { data: email, error } = await supabase
        .from('pr_emails')
        .insert({
            ...emailData,
            status: 'draft',
            drafted_by: userId,
        })
        .select()
        .single();

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'email',
        entityId: email.id,
        action: 'draft_email',
        previousStatus: 'none',
        newStatus: 'draft',
    });

    return email;
}

export async function submitPREmailForApproval(emailId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    const { error } = await supabase
        .from('pr_emails')
        .update({ status: 'pending_faculty' })
        .eq('id', emailId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'email',
        entityId: emailId,
        action: 'submit_for_approval',
        previousStatus: 'draft',
        newStatus: 'pending_faculty',
    });
}

export async function approvePREmail(emailId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    const { error } = await supabase
        .from('pr_emails')
        .update({
            status: 'faculty_approved',
            faculty_approved_by: userId,
            faculty_approved_at: new Date().toISOString(),
        })
        .eq('id', emailId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'email',
        entityId: emailId,
        action: 'approve_email',
        previousStatus: 'pending_faculty',
        newStatus: 'faculty_approved',
    });
}

export async function rejectPREmail(
    emailId: string,
    userId: string,
    userRole: UserRole,
    reason: string
) {
    const supabase = createClient();

    const { error } = await supabase
        .from('pr_emails')
        .update({
            status: 'faculty_rejected',
            faculty_rejection_reason: reason,
        })
        .eq('id', emailId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'email',
        entityId: emailId,
        action: 'reject_email',
        previousStatus: 'pending_faculty',
        newStatus: 'faculty_rejected',
        reason,
    });
}

// ============================================
// POSTER APPROVAL WORKFLOW
// ============================================

export async function uploadPoster(posterData: any, userId: string, userRole: UserRole) {
    const supabase = createClient();

    const { data: poster, error } = await supabase
        .from('posters')
        .insert({
            ...posterData,
            status: 'pending_faculty',
            uploaded_by: userId,
        })
        .select()
        .single();

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'poster',
        entityId: poster.id,
        action: 'upload_poster',
        previousStatus: 'none',
        newStatus: 'pending_faculty',
    });

    return poster;
}

export async function approvePoster(posterId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    const { error } = await supabase
        .from('posters')
        .update({
            status: 'published',
            faculty_approved_by: userId,
            faculty_approved_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
        })
        .eq('id', posterId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'poster',
        entityId: posterId,
        action: 'approve_poster',
        previousStatus: 'pending_faculty',
        newStatus: 'published',
    });

    const { data: comm } = await supabase.from('committees').select('id').ilike('name', '%graphics%').limit(1).maybeSingle();
    if (comm?.id) {
        await notifyCommittee(supabase, comm.id, {
            type: 'poster',
            title: 'Poster approved and published',
            message: 'A poster was faculty-approved and is now published.',
            link: '/dashboard/posters',
            related_id: posterId,
        });
    }
}

export async function rejectPoster(
    posterId: string,
    userId: string,
    userRole: UserRole,
    reason: string
) {
    const supabase = createClient();

    const { error } = await supabase
        .from('posters')
        .update({
            status: 'faculty_rejected',
            faculty_rejection_reason: reason,
        })
        .eq('id', posterId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'poster',
        entityId: posterId,
        action: 'reject_poster',
        previousStatus: 'pending_faculty',
        newStatus: 'faculty_rejected',
        reason,
    });
}

// ============================================
// FINANCE APPROVAL WORKFLOW
// ============================================

export async function submitFinanceTransaction(
    transactionData: any,
    userId: string,
    userRole: UserRole
) {
    const supabase = createClient();

    const { data: transaction, error } = await supabase
        .from('finance_transactions')
        .insert({
            ...transactionData,
            submitted_by: userId,
            approval_status: 'pending',
        })
        .select()
        .single();

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'finance',
        entityId: transaction.id,
        action: 'submit_transaction',
        previousStatus: 'none',
        newStatus: 'pending',
    });

    await notifyFaculty(supabase, {
        type: 'finance',
        title: 'New finance entry pending',
        message: 'A finance transaction was submitted and needs approval.',
        link: '/dashboard/faculty/finance',
        related_id: transaction.id,
    });

    return transaction;
}

export async function approveFinanceTransaction(
    transactionId: string,
    userId: string,
    userRole: UserRole
) {
    const supabase = createClient();

    const { error } = await supabase
        .from('finance_transactions')
        .update({
            approval_status: 'approved',
            approved_by: userId,
            approved_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'finance',
        entityId: transactionId,
        action: 'approve_transaction',
        previousStatus: 'pending',
        newStatus: 'approved',
    });
}

export async function rejectFinanceTransaction(
    transactionId: string,
    userId: string,
    userRole: UserRole,
    reason: string
) {
    const supabase = createClient();

    const { error } = await supabase
        .from('finance_transactions')
        .update({
            approval_status: 'rejected',
            rejection_reason: reason,
        })
        .eq('id', transactionId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'finance',
        entityId: transactionId,
        action: 'reject_transaction',
        previousStatus: 'pending',
        newStatus: 'rejected',
        reason,
    });
}

// ============================================
// KICKOFF APPROVAL WORKFLOW
// ============================================

export async function approveKickoffTeam(
    teamId: string,
    userId: string,
    userRole: UserRole
) {
    const supabase = createClient();

    const { error } = await supabase
        .from('kickoff_teams')
        .update({
            approved: true,
            approved_by: userId,
            approved_at: new Date().toISOString(),
        })
        .eq('id', teamId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'kickoff',
        entityId: teamId,
        action: 'approve_team',
        previousStatus: 'pending',
        newStatus: 'approved',
    });
}

export async function rejectKickoffTeam(
    teamId: string,
    userId: string,
    userRole: UserRole,
    reason: string
) {
    const supabase = createClient();

    const { error } = await supabase
        .from('kickoff_teams')
        .update({
            approved: false,
            rejection_reason: reason,
        })
        .eq('id', teamId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'kickoff',
        entityId: teamId,
        action: 'reject_team',
        previousStatus: 'pending',
        newStatus: 'rejected',
        reason,
    });
}

export async function approveKickoffSchedule(
    scheduleId: string,
    userId: string,
    userRole: UserRole
) {
    const supabase = createClient();

    const { error } = await supabase
        .from('kickoff_schedule')
        .update({
            approved_by: userId,
            approved_at: new Date().toISOString(),
            visible_to_students: true,
        })
        .eq('id', scheduleId);

    if (error) throw error;

    await logApproval({
        userId,
        userRole,
        entityType: 'schedule',
        entityId: scheduleId,
        action: 'approve_schedule',
        previousStatus: 'pending',
        newStatus: 'approved',
    });
}
