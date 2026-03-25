import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications';
import {
  getApprovalReminderEligibility,
  getTaskReminderEligibility,
  getCooldownStatus,
  type Recipient,
} from '@/lib/reminder-eligibility';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.iicheavvu.in';

// ---- Email template helpers ----

function buildApprovalEmailHtml(
  eventName: string,
  requesterName: string,
  pendingSince: string,
  eventId: string,
): string {
  const reviewUrl = `${BASE_URL}/dashboard/event-detail/${eventId}`;
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2>Reminder: Approval Pending</h2>
      <p>The event <strong>${eventName}</strong> is awaiting your approval.</p>
      <p>Requested by: <strong>${requesterName}</strong></p>
      <p>Pending since: ${pendingSince}</p>
      <p style="margin-top:24px;">
        <a href="${reviewUrl}"
           style="background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Review Now
        </a>
      </p>
    </div>`;
}

function buildTaskEmailHtml(
  taskName: string,
  eventName: string,
  deadline: string | null,
): string {
  const taskUrl = `${BASE_URL}/dashboard/tasks`;
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2>Reminder: Task Pending</h2>
      <p>The task <strong>${taskName}</strong> for event <strong>${eventName}</strong> is still pending.</p>
      ${deadline ? `<p>Deadline: <strong>${new Date(deadline).toLocaleDateString()}</strong></p>` : ''}
      <p style="margin-top:24px;">
        <a href="${taskUrl}"
           style="background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
          View Task
        </a>
      </p>
    </div>`;
}


// ---- POST handler ----

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 2.1 — Authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2.1 — Parse & validate request body
    const body = await request.json();
    const { entityId, entityType, message } = body as {
      entityId?: string;
      entityType?: string;
      message?: string;
    };

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId is required' },
        { status: 400 },
      );
    }

    if (entityType !== 'approval' && entityType !== 'task') {
      return NextResponse.json(
        { error: "Invalid entityType. Must be 'approval' or 'task'" },
        { status: 400 },
      );
    }

    // Fetch sender profile for email templates
    const { data: senderProfile } = await (supabase as any)
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const senderName: string = senderProfile?.name ?? 'A team member';

    // ---- Branch by entityType ----

    let recipients: Recipient[] = [];
    let reminderType: string;
    let emailSubject: string;
    let buildEmailBody: (r: Recipient) => string;
    let entityLabel: string; // for notification message

    if (entityType === 'approval') {
      // 2.2 — Approval authorization
      const { data: event, error: eventErr } = await (supabase as any)
        .from('events')
        .select('id, title, status, created_by, committee_id, updated_at')
        .eq('id', entityId)
        .single();

      if (eventErr || !event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 },
        );
      }

      // Determine pending approvers based on status
      let pendingApprovers: Recipient[] = [];
      let headApproverId: string | null = null;
      let ecApprovals: { user_id: string }[] = [];

      if (event.status === 'pending_head_approval') {
        // Head / co-head of the event's committee
        const { data: headMembers } = await (supabase as any)
          .from('committee_members')
          .select('user_id, position, profiles(id, name, email)')
          .eq('committee_id', event.committee_id)
          .in('position', ['head', 'co_head']);

        if (headMembers) {
          pendingApprovers = headMembers.map((m: any) => ({
            userId: m.profiles.id,
            name: m.profiles.name,
            email: m.profiles.email,
          }));
          // The head approver is the head member (used for later stages)
          const head = headMembers.find((m: any) => m.position === 'head');
          headApproverId = head?.user_id ?? null;
        }
      } else if (event.status === 'pending_ec_approval') {
        // Find head approver id for authorization check
        const { data: headMembers } = await (supabase as any)
          .from('committee_members')
          .select('user_id, position')
          .eq('committee_id', event.committee_id)
          .in('position', ['head', 'co_head']);

        if (headMembers) {
          const head = headMembers.find((m: any) => m.position === 'head');
          headApproverId = head?.user_id ?? headMembers[0]?.user_id ?? null;
        }

        // EC members who haven't approved yet
        const { data: existingApprovals } = await (supabase as any)
          .from('ec_approvals')
          .select('user_id')
          .eq('event_id', entityId);

        ecApprovals = existingApprovals ?? [];
        const approvedUserIds = new Set(
          ecApprovals.map((a: any) => a.user_id),
        );

        const { data: ecMembers } = await (supabase as any)
          .from('profiles')
          .select('id, name, email')
          .not('executive_role', 'is', null);

        if (ecMembers) {
          pendingApprovers = ecMembers
            .filter((m: any) => !approvedUserIds.has(m.id))
            .map((m: any) => ({
              userId: m.id,
              name: m.name,
              email: m.email,
            }));
        }
      } else if (event.status === 'pending_faculty_approval') {
        // Find head approver id
        const { data: headMembers } = await (supabase as any)
          .from('committee_members')
          .select('user_id, position')
          .eq('committee_id', event.committee_id)
          .in('position', ['head', 'co_head']);

        if (headMembers) {
          const head = headMembers.find((m: any) => m.position === 'head');
          headApproverId = head?.user_id ?? headMembers[0]?.user_id ?? null;
        }

        // EC approvals for authorization check
        const { data: existingApprovals } = await (supabase as any)
          .from('ec_approvals')
          .select('user_id')
          .eq('event_id', entityId);

        ecApprovals = existingApprovals ?? [];

        // Faculty members (is_faculty or is_admin)
        const { data: facultyMembers } = await (supabase as any)
          .from('profiles')
          .select('id, name, email')
          .or('is_faculty.eq.true,is_admin.eq.true');

        if (facultyMembers) {
          pendingApprovers = facultyMembers.map((m: any) => ({
            userId: m.id,
            name: m.name,
            email: m.email,
          }));
        }
      }

      // Check eligibility
      const eligibility = getApprovalReminderEligibility(
        event.status,
        user.id,
        event.created_by,
        headApproverId,
        ecApprovals,
        pendingApprovers,
      );

      if (!eligibility.canSend) {
        return NextResponse.json(
          {
            error:
              eligibility.reason ??
              'You are not authorized to send a reminder for this entity',
          },
          { status: 403 },
        );
      }

      recipients = eligibility.recipients;
      reminderType = 'approval_reminder';
      emailSubject = 'Reminder: Approval Pending for Event';
      entityLabel = event.title;

      const pendingSince = event.updated_at
        ? new Date(event.updated_at).toLocaleString()
        : 'N/A';

      buildEmailBody = () =>
        buildApprovalEmailHtml(event.title, senderName, pendingSince, event.id);
    } else {
      // 2.2 — Task authorization
      const { data: taskRows, error: taskErr } = await (supabase as any)
        .from('task_assignments')
        .select(
          'id, title, status, event_id, assigned_to_committee, deadline',
        )
        .eq('id', entityId)
        .limit(1);

      const task = taskRows?.[0];

      if (taskErr || !task) {
        console.log('[Reminders API] Task not found:', { entityId, taskErr: taskErr?.message, rowCount: taskRows?.length });
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 },
        );
      }

      if (task.status === 'completed') {
        return NextResponse.json(
          { error: 'Cannot send reminder for a completed task' },
          { status: 400 },
        );
      }

      // Fetch event to get created_by and committee_id
      const { data: event } = await (supabase as any)
        .from('events')
        .select('id, title, created_by, committee_id')
        .eq('id', task.event_id)
        .single();

      const eventCreatorId: string = event?.created_by ?? '';
      const eventName: string = event?.title ?? 'Unknown Event';

      // Check user profile for isEC / isFaculty
      const { data: userProfile } = await (supabase as any)
        .from('profiles')
        .select('executive_role, is_faculty, is_admin')
        .eq('id', user.id)
        .single();

      const isEC = !!userProfile?.executive_role;
      const isFaculty =
        !!userProfile?.is_faculty || !!userProfile?.is_admin;

      // Check if user is in the proposing committee
      let isProposingCommitteeMember = false;
      if (event?.committee_id) {
        const { data: membership } = await (supabase as any)
          .from('committee_members')
          .select('user_id')
          .eq('committee_id', event.committee_id)
          .eq('user_id', user.id)
          .single();
        isProposingCommitteeMember = !!membership;
      }

      // Get committee members for the assigned committee
      let committeeMembers: Recipient[] = [];
      if (task.assigned_to_committee) {
        const { data: members } = await (supabase as any)
          .from('committee_members')
          .select('user_id, profiles(id, name, email)')
          .eq('committee_id', task.assigned_to_committee);

        if (members) {
          committeeMembers = members.map((m: any) => ({
            userId: m.profiles.id,
            name: m.profiles.name,
            email: m.profiles.email,
          }));
        }
      }

      const eligibility = getTaskReminderEligibility(
        task.status,
        user.id,
        isEC,
        isFaculty,
        eventCreatorId,
        committeeMembers,
        isProposingCommitteeMember,
      );

      if (!eligibility.canSend) {
        return NextResponse.json(
          {
            error:
              eligibility.reason ??
              'You are not authorized to send a reminder for this entity',
          },
          { status: 403 },
        );
      }

      recipients = eligibility.recipients;
      reminderType = 'task_reminder';
      emailSubject = 'Reminder: Task Pending';
      entityLabel = task.title;

      buildEmailBody = () =>
        buildTaskEmailHtml(task.title, eventName, task.deadline ?? null);
    }


    // 2.4 — Dispatch reminders to each recipient
    let recipientCount = 0;

    console.log('[Reminders API] Dispatching to recipients:', recipients.map(r => ({ userId: r.userId, name: r.name, email: r.email })));

    for (const recipient of recipients) {
      // Insert portal notification
      const notifTitle =
        entityType === 'approval'
          ? 'Reminder: Approval Pending'
          : 'Reminder: Task Pending';

      const notifMessage =
        entityType === 'approval'
          ? `The event '${entityLabel}' is awaiting your approval. Please review it.`
          : `The task '${entityLabel}' is pending. Please complete it.`;

      await (supabase as any).from('notifications').insert({
        user_id: recipient.userId,
        type: 'reminder',
        title: notifTitle,
        message: message || notifMessage,
        related_id: entityId,
        read: false,
      });

      // 2.5 — Send email (wrapped in try/catch)
      try {
        const emailResult = await sendEmail(recipient.email, emailSubject, buildEmailBody(recipient));
        console.log(`[Reminders API] Email to ${recipient.email}:`, emailResult);
      } catch (emailError) {
        console.error(
          `Failed to send reminder email to ${recipient.email}:`,
          emailError,
        );
        // Continue processing remaining recipients
      }

      // Insert reminder log
      await (supabase as any).from('reminders').insert({
        proposal_id: entityId,
        sent_by: user.id,
        sent_to: recipient.userId,
        reminder_type: reminderType,
        message: message || null,
      });

      recipientCount++;
    }

    return NextResponse.json({
      success: true,
      recipientCount,
    });
  } catch (error) {
    console.error('Reminder API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
