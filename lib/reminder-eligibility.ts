// ============================================
// REMINDER ELIGIBILITY UTILITIES
// Pure functions for determining reminder authorization,
// overdue status, and cooldown enforcement.
// ============================================

// --- Interfaces ---

export interface Recipient {
    userId: string;
    name: string;
    email: string;
}

export interface ReminderEligibility {
    canSend: boolean;
    recipients: Recipient[];
    reason?: string;
}

export interface CooldownStatus {
    active: boolean;
    remainingSeconds: number;
}

export type OverdueStatus = 'overdue' | 'pending' | 'normal';

// --- Constants ---

/** Approval stages that support reminders */
const PENDING_APPROVAL_STATUSES = [
    'pending_head_approval',
    'pending_second_head_approval',
    'pending_ec_approval',
    'pending_faculty_approval',
] as const;

/** Cooldown period in milliseconds (6 hours) */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Overdue threshold for approvals in milliseconds (48 hours) */
const APPROVAL_OVERDUE_MS = 48 * 60 * 60 * 1000;

// --- Functions ---

/**
 * Determines whether the current user can send an approval reminder
 * and who the recipients should be, based on the event's approval stage.
 *
 * - pending_head_approval: only the event creator can send → recipients are the head approver
 * - pending_second_head_approval: event creator or first head can send → recipients are other committee heads (not the first approver)
 * - pending_ec_approval: event creator + head approver can send → recipients are pending EC approvers
 * - pending_faculty_approval: event creator + head approver + approving EC members can send → recipients are pending faculty approvers
 */
export function getApprovalReminderEligibility(
    eventStatus: string,
    currentUserId: string,
    eventCreatorId: string,
    headApproverId: string | null,
    ecApprovals: { user_id: string }[],
    pendingApprovers: Recipient[],
): ReminderEligibility {
    // Must be a pending approval status
    if (
        !(PENDING_APPROVAL_STATUSES as readonly string[]).includes(eventStatus)
    ) {
        return {
            canSend: false,
            recipients: [],
            reason: 'Event is not in a pending approval status',
        };
    }

    // Must have at least one pending approver to remind
    if (pendingApprovers.length === 0) {
        return {
            canSend: false,
            recipients: [],
            reason: 'No pending approvers to remind',
        };
    }

    switch (eventStatus) {
        case 'pending_head_approval': {
            // Only the event creator can send
            if (currentUserId === eventCreatorId) {
                return { canSend: true, recipients: pendingApprovers };
            }
            return {
                canSend: false,
                recipients: [],
                reason: 'Only the event creator can send reminders at the head approval stage',
            };
        }

        case 'pending_second_head_approval': {
            // Creator or first head can remind the other head(s)
            const authorized =
                currentUserId === eventCreatorId ||
                (headApproverId !== null && currentUserId === headApproverId);
            if (authorized) {
                return { canSend: true, recipients: pendingApprovers };
            }
            return {
                canSend: false,
                recipients: [],
                reason: 'Only the event creator or first head can send reminders at the second-head stage',
            };
        }

        case 'pending_ec_approval': {
            // Event creator + head approver can send
            const authorized =
                currentUserId === eventCreatorId ||
                (headApproverId !== null && currentUserId === headApproverId);
            if (authorized) {
                return { canSend: true, recipients: pendingApprovers };
            }
            return {
                canSend: false,
                recipients: [],
                reason:
                    'Only the event creator or head approver can send reminders at the EC approval stage',
            };
        }

        case 'pending_faculty_approval': {
            // Event creator + head approver + approving EC members can send
            const ecApproverIds = new Set(ecApprovals.map((a) => a.user_id));
            const authorized =
                currentUserId === eventCreatorId ||
                (headApproverId !== null && currentUserId === headApproverId) ||
                ecApproverIds.has(currentUserId);
            if (authorized) {
                return { canSend: true, recipients: pendingApprovers };
            }
            return {
                canSend: false,
                recipients: [],
                reason:
                    'Only the event creator, head approver, or approving EC members can send reminders at the faculty approval stage',
            };
        }

        default:
            return {
                canSend: false,
                recipients: [],
                reason: 'Event is not in a pending approval status',
            };
    }
}


/**
 * Determines whether the current user can send a task reminder
 * and who the recipients should be.
 *
 * Any non-completed task can receive reminders from EC members, faculty, or the event creator.
 * Recipients are the committee members assigned to the task.
 */
export function getTaskReminderEligibility(
    taskStatus: string,
    currentUserId: string,
    isEC: boolean,
    isFaculty: boolean,
    eventCreatorId: string,
    committeeMembers: Recipient[],
    isProposingCommitteeMember: boolean = false,
): ReminderEligibility {
    // Completed tasks cannot receive reminders
    if (taskStatus === 'completed') {
        return {
            canSend: false,
            recipients: [],
            reason: 'Cannot send reminder for a completed task',
        };
    }

    // Must have committee members to remind
    if (committeeMembers.length === 0) {
        return {
            canSend: false,
            recipients: [],
            reason: 'No committee members to remind',
        };
    }

    // EC members, faculty, event creator, or proposing committee members can send
    const authorized =
        isEC || isFaculty || currentUserId === eventCreatorId || isProposingCommitteeMember;

    if (authorized) {
        return { canSend: true, recipients: committeeMembers };
    }

    return {
        canSend: false,
        recipients: [],
        reason:
            'Only EC members, faculty, the event creator, or proposing committee members can send task reminders',
    };
}

/**
 * Determines the overdue status of an approval or task.
 *
 * - Approval: "overdue" if pending for more than 48 hours (based on updated_at), "pending" if in a pending status, "normal" otherwise.
 * - Task: "overdue" if past deadline and not completed, "pending" if not completed and has a future/no deadline, "normal" if completed.
 *
 * @param entityType - 'approval' or 'task'
 * @param timestamp  - For approvals: the event's updated_at. For tasks: the task's deadline (null if no deadline).
 * @param currentStatus - The current status of the event or task.
 * @param now - Optional current time for testability. Defaults to new Date().
 */
export function getOverdueStatus(
    entityType: 'approval' | 'task',
    timestamp: string | Date | null,
    currentStatus: string,
    now: Date = new Date(),
): OverdueStatus {
    if (entityType === 'approval') {
        const isPending = (PENDING_APPROVAL_STATUSES as readonly string[]).includes(
            currentStatus,
        );
        if (!isPending) {
            return 'normal';
        }
        // If no timestamp provided, treat as pending (not overdue)
        if (timestamp == null) {
            return 'pending';
        }
        const updatedAt = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        const elapsed = now.getTime() - updatedAt.getTime();
        return elapsed > APPROVAL_OVERDUE_MS ? 'overdue' : 'pending';
    }

    // Task
    if (currentStatus === 'completed') {
        return 'normal';
    }
    // No deadline → pending but not overdue
    if (timestamp == null) {
        return 'pending';
    }
    const deadline = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return now.getTime() > deadline.getTime() ? 'overdue' : 'pending';
}

/**
 * Determines whether a cooldown is active for a given user-entity pair.
 *
 * @param lastReminderAt - Timestamp of the last reminder sent, or null if none.
 * @param now - Optional current time for testability. Defaults to new Date().
 * @returns `{ active, remainingSeconds }` — active is true if within the 6-hour window.
 */
export function getCooldownStatus(
    lastReminderAt: Date | null,
    now: Date = new Date(),
): CooldownStatus {
    if (lastReminderAt === null) {
        return { active: false, remainingSeconds: 0 };
    }

    const elapsed = now.getTime() - lastReminderAt.getTime();
    const remaining = COOLDOWN_MS - elapsed;

    if (remaining <= 0) {
        return { active: false, remainingSeconds: 0 };
    }

    return {
        active: true,
        remainingSeconds: Math.ceil(remaining / 1000),
    };
}
