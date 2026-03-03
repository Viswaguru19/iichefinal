// ============================================
// APPROVAL WORKFLOW UTILITIES
// Handles all approval processes with logging
// ============================================

import { createClient } from '@/lib/supabase/client';
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

export async function approveEventAsHead(eventId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    // Get current event
    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');

    // Update to pending faculty approval
    const { error } = await supabase
        .from('events')
        .update({
            status: 'pending_faculty_approval',
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
        newStatus: 'pending_faculty_approval',
    });
}

export async function approveEventAsFaculty(eventId: string, userId: string, userRole: UserRole) {
    const supabase = createClient();

    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (!event) throw new Error('Event not found');

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
}

export async function rejectEvent(
    eventId: string,
    userId: string,
    userRole: UserRole,
    reason: string
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
        .update({ status: 'cancelled' })
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
// TASK APPROVAL WORKFLOW
// ============================================

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

export async function approveTaskAsEC(
    taskId: string,
    userId: string,
    userRole: UserRole,
    modifications?: any
) {
    const supabase = createClient();

    const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

    if (!task) throw new Error('Task not found');

    const updateData: any = {
        status: 'not_started',
        ec_approved_by: userId,
        ec_approved_at: new Date().toISOString(),
    };

    // Apply modifications if provided
    if (modifications) {
        Object.assign(updateData, modifications);
    }

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
        metadata: modifications,
    });
}

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
