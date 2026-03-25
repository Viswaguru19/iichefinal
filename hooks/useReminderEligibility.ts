'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    getApprovalReminderEligibility,
    getTaskReminderEligibility,
    getCooldownStatus,
} from '@/lib/reminder-eligibility';

export interface UseReminderEligibilityReturn {
    canSend: boolean;
    cooldownActive: boolean;
    cooldownRemaining: string;
    lastReminderAt: Date | null;
    loading: boolean;
}

function formatCooldownRemaining(seconds: number): string {
    if (seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h 0m`;
    return `${minutes}m`;
}

export function useReminderEligibility(
    entityId: string,
    entityType: 'approval' | 'task',
): UseReminderEligibilityReturn {
    const [canSend, setCanSend] = useState(false);
    const [cooldownActive, setCooldownActive] = useState(false);
    const [cooldownRemaining, setCooldownRemaining] = useState('');
    const [lastReminderAt, setLastReminderAt] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function fetchEligibility() {
            setLoading(true);
            try {
                const supabase = createClient();

                // Fetch current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user || cancelled) {
                    setLoading(false);
                    return;
                }

                // Fetch user profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, executive_role, is_faculty, is_admin')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.error('[useReminderEligibility] Profile error:', profileError);
                }

                if (!profile || cancelled) {
                    setLoading(false);
                    return;
                }

                // Fetch last reminder timestamp
                const reminderType = entityType === 'approval' ? 'approval_reminder' : 'task_reminder';
                const { data: lastReminderRows } = await supabase
                    .from('reminders')
                    .select('created_at')
                    .eq('proposal_id', entityId)
                    .eq('sent_by', user.id)
                    .eq('reminder_type', reminderType)
                    .order('created_at', { ascending: false })
                    .limit(1);

                const lastAt = lastReminderRows?.[0]?.created_at ? new Date(lastReminderRows[0].created_at) : null;
                if (cancelled) return;
                setLastReminderAt(lastAt);

                // Compute cooldown
                const cooldown = getCooldownStatus(lastAt);
                setCooldownActive(cooldown.active);
                setCooldownRemaining(formatCooldownRemaining(cooldown.remainingSeconds));

                if (entityType === 'approval') {
                    // Fetch event data
                    const { data: eventRows } = await supabase
                        .from('events')
                        .select('status, created_by, committee_id, updated_at')
                        .eq('id', entityId)
                        .limit(1);

                    const event = eventRows?.[0];
                    if (!event || cancelled) {
                        setLoading(false);
                        return;
                    }

                    // Fetch head approver from committee_members
                    const { data: headMembers } = await supabase
                        .from('committee_members')
                        .select('user_id, profiles(id, name, email)')
                        .eq('committee_id', event.committee_id)
                        .eq('position', 'head')
                        .limit(1);

                    const headMember = headMembers?.[0] ?? null;
                    const headApproverId = headMember?.user_id ?? null;

                    // Fetch EC approvals
                    const { data: ecApprovals } = await supabase
                        .from('ec_approvals')
                        .select('user_id')
                        .eq('event_id', entityId);

                    // Determine pending approvers based on status
                    let pendingApprovers: { userId: string; name: string; email: string }[] = [];

                    if (event.status === 'pending_head_approval' && headMember) {
                        const p = headMember.profiles as unknown as { id: string; name: string; email: string };
                        if (p) {
                            pendingApprovers = [{ userId: p.id, name: p.name, email: p.email }];
                        }
                    } else if (event.status === 'pending_ec_approval') {
                        // EC members who haven't approved yet
                        const approvedIds = new Set((ecApprovals ?? []).map((a) => a.user_id));
                        const { data: ecMembers } = await supabase
                            .from('profiles')
                            .select('id, name, email')
                            .not('executive_role', 'is', null);

                        pendingApprovers = (ecMembers ?? [])
                            .filter((m) => !approvedIds.has(m.id))
                            .map((m) => ({ userId: m.id, name: m.name, email: m.email }));
                    } else if (event.status === 'pending_faculty_approval') {
                        const { data: facultyMembers } = await supabase
                            .from('profiles')
                            .select('id, name, email')
                            .or('is_faculty.eq.true,is_admin.eq.true');

                        pendingApprovers = (facultyMembers ?? []).map((m) => ({
                            userId: m.id,
                            name: m.name,
                            email: m.email,
                        }));
                    }

                    if (cancelled) return;

                    const eligibility = getApprovalReminderEligibility(
                        event.status,
                        profile.id,
                        event.created_by,
                        headApproverId,
                        ecApprovals ?? [],
                        pendingApprovers,
                    );

                    setCanSend(eligibility.canSend);
                } else {
                    // entityType === 'task'
                    // Fetch task data
                    const { data: taskRows } = await supabase
                        .from('task_assignments')
                        .select('status, event_id, assigned_to_committee, deadline')
                        .eq('id', entityId)
                        .limit(1);

                    const task = taskRows?.[0];
                    if (!task || cancelled) {
                        setLoading(false);
                        return;
                    }

                    // Fetch event creator and committee_id
                    const { data: eventRows } = await supabase
                        .from('events')
                        .select('created_by, committee_id')
                        .eq('id', task.event_id)
                        .limit(1);

                    const event = eventRows?.[0];
                    const eventCreatorId = event?.created_by ?? '';

                    // Check if user is in the proposing committee
                    let isProposingCommitteeMember = false;
                    if (event?.committee_id) {
                        const { data: membershipRows } = await supabase
                            .from('committee_members')
                            .select('user_id')
                            .eq('committee_id', event.committee_id)
                            .eq('user_id', user.id)
                            .limit(1);
                        isProposingCommitteeMember = (membershipRows?.length ?? 0) > 0;
                    }

                    // Fetch committee members for the assigned committee
                    let committeeMembers: { userId: string; name: string; email: string }[] = [];
                    if (task.assigned_to_committee) {
                        const { data: members } = await supabase
                            .from('committee_members')
                            .select('user_id, profiles!committee_members_user_id_fkey(id, name, email)')
                            .eq('committee_id', task.assigned_to_committee);

                        committeeMembers = (members ?? []).map((m: any) => {
                            const p = m.profiles;
                            return { userId: p?.id ?? m.user_id, name: p?.name ?? '', email: p?.email ?? '' };
                        });

                        // Fallback: if join didn't work, at least use user_ids so eligibility passes
                        if (committeeMembers.length === 0 && (members?.length ?? 0) > 0) {
                            committeeMembers = (members ?? []).map((m: any) => ({
                                userId: m.user_id, name: 'Committee Member', email: '',
                            }));
                        }
                    }

                    if (cancelled) return;

                    const isEC = !!profile.executive_role;
                    const isFaculty = !!profile.is_faculty || !!profile.is_admin;

                    console.log('[useReminderEligibility] Task check:', {
                        taskStatus: task.status,
                        userId: profile.id,
                        isEC,
                        isFaculty,
                        eventCreatorId,
                        committeeMembersCount: committeeMembers.length,
                        isProposingCommitteeMember,
                    });

                    const eligibility = getTaskReminderEligibility(
                        task.status,
                        profile.id,
                        isEC,
                        isFaculty,
                        eventCreatorId,
                        committeeMembers,
                        isProposingCommitteeMember,
                    );

                    setCanSend(eligibility.canSend);
                }
            } catch (err) {
                // On error, default to not eligible
                console.error('[useReminderEligibility] Error:', err);
                setCanSend(false);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchEligibility();

        return () => {
            cancelled = true;
        };
    }, [entityId, entityType]);

    return { canSend, cooldownActive, cooldownRemaining, lastReminderAt, loading };
}
