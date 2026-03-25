import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    getApprovalReminderEligibility,
    getTaskReminderEligibility,
    type Recipient,
} from '../lib/reminder-eligibility';

// --- Helpers ---

function makeRecipient(userId: string): Recipient {
    return { userId, name: `User ${userId}`, email: `${userId}@test.com` };
}

const CREATOR = 'creator-id';
const HEAD = 'head-id';
const EC1 = 'ec-member-1';
const EC2 = 'ec-member-2';
const RANDOM = 'random-user';

const pendingApprovers = [makeRecipient('approver-1'), makeRecipient('approver-2')];
const committeeMembers = [makeRecipient('member-1'), makeRecipient('member-2')];

// ============================================================
// Unit Tests — getApprovalReminderEligibility
// ============================================================

describe('getApprovalReminderEligibility', () => {
    describe('pending_head_approval', () => {
        it('creator can send', () => {
            const result = getApprovalReminderEligibility(
                'pending_head_approval', CREATOR, CREATOR, HEAD, [], pendingApprovers,
            );
            expect(result.canSend).toBe(true);
            expect(result.recipients).toEqual(pendingApprovers);
        });

        it('non-creator cannot send', () => {
            const result = getApprovalReminderEligibility(
                'pending_head_approval', RANDOM, CREATOR, HEAD, [], pendingApprovers,
            );
            expect(result.canSend).toBe(false);
            expect(result.recipients).toEqual([]);
        });
    });

    describe('pending_ec_approval', () => {
        it('creator can send', () => {
            const result = getApprovalReminderEligibility(
                'pending_ec_approval', CREATOR, CREATOR, HEAD, [], pendingApprovers,
            );
            expect(result.canSend).toBe(true);
        });

        it('head approver can send', () => {
            const result = getApprovalReminderEligibility(
                'pending_ec_approval', HEAD, CREATOR, HEAD, [], pendingApprovers,
            );
            expect(result.canSend).toBe(true);
        });

        it('random user cannot send', () => {
            const result = getApprovalReminderEligibility(
                'pending_ec_approval', RANDOM, CREATOR, HEAD, [], pendingApprovers,
            );
            expect(result.canSend).toBe(false);
        });
    });

    describe('pending_faculty_approval', () => {
        const ecApprovals = [{ user_id: EC1 }, { user_id: EC2 }];

        it('creator can send', () => {
            const result = getApprovalReminderEligibility(
                'pending_faculty_approval', CREATOR, CREATOR, HEAD, ecApprovals, pendingApprovers,
            );
            expect(result.canSend).toBe(true);
        });

        it('head approver can send', () => {
            const result = getApprovalReminderEligibility(
                'pending_faculty_approval', HEAD, CREATOR, HEAD, ecApprovals, pendingApprovers,
            );
            expect(result.canSend).toBe(true);
        });

        it('EC approver can send', () => {
            const result = getApprovalReminderEligibility(
                'pending_faculty_approval', EC1, CREATOR, HEAD, ecApprovals, pendingApprovers,
            );
            expect(result.canSend).toBe(true);
        });

        it('random user cannot send', () => {
            const result = getApprovalReminderEligibility(
                'pending_faculty_approval', RANDOM, CREATOR, HEAD, ecApprovals, pendingApprovers,
            );
            expect(result.canSend).toBe(false);
        });
    });

    it('non-pending status returns canSend=false', () => {
        const result = getApprovalReminderEligibility(
            'approved', CREATOR, CREATOR, HEAD, [], pendingApprovers,
        );
        expect(result.canSend).toBe(false);
    });

    it('empty pendingApprovers returns canSend=false', () => {
        const result = getApprovalReminderEligibility(
            'pending_head_approval', CREATOR, CREATOR, HEAD, [], [],
        );
        expect(result.canSend).toBe(false);
    });
});

// ============================================================
// Unit Tests — getTaskReminderEligibility
// ============================================================

describe('getTaskReminderEligibility', () => {
    it('EC member can send for non-completed task', () => {
        const result = getTaskReminderEligibility(
            'in_progress', RANDOM, true, false, CREATOR, committeeMembers,
        );
        expect(result.canSend).toBe(true);
        expect(result.recipients).toEqual(committeeMembers);
    });

    it('Faculty can send for non-completed task', () => {
        const result = getTaskReminderEligibility(
            'in_progress', RANDOM, false, true, CREATOR, committeeMembers,
        );
        expect(result.canSend).toBe(true);
    });

    it('Event creator can send for non-completed task', () => {
        const result = getTaskReminderEligibility(
            'in_progress', CREATOR, false, false, CREATOR, committeeMembers,
        );
        expect(result.canSend).toBe(true);
    });

    it('Random user cannot send', () => {
        const result = getTaskReminderEligibility(
            'in_progress', RANDOM, false, false, CREATOR, committeeMembers,
        );
        expect(result.canSend).toBe(false);
    });

    it('Completed task returns canSend=false', () => {
        const result = getTaskReminderEligibility(
            'completed', CREATOR, true, true, CREATOR, committeeMembers,
        );
        expect(result.canSend).toBe(false);
    });

    it('Empty committee members returns canSend=false', () => {
        const result = getTaskReminderEligibility(
            'in_progress', CREATOR, true, false, CREATOR, [],
        );
        expect(result.canSend).toBe(false);
    });
});


// ============================================================
// Property-Based Tests
// ============================================================

const PENDING_STATUSES = [
    'pending_head_approval',
    'pending_ec_approval',
    'pending_faculty_approval',
] as const;

// Feature: approval-reminder-system, Property 1: Approval Reminder Authorization
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
describe('Property 1: Approval Reminder Authorization', () => {
    it('canSend=true iff user is in the authorized set for the stage', () => {
        const userIdArb = fc.stringMatching(/^[a-z0-9]{8}$/);

        fc.assert(
            fc.property(
                fc.constantFrom(...PENDING_STATUSES),
                userIdArb, // currentUserId
                userIdArb, // creatorId
                userIdArb, // headApproverId
                fc.array(userIdArb, { minLength: 0, maxLength: 5 }), // ecApproverIds
                (status, currentUserId, creatorId, headApproverId, ecApproverIds) => {
                    const ecApprovals = ecApproverIds.map((id) => ({ user_id: id }));
                    const approvers = [makeRecipient('target-1')];

                    const result = getApprovalReminderEligibility(
                        status, currentUserId, creatorId, headApproverId, ecApprovals, approvers,
                    );

                    // Build the expected authorized set for this stage
                    const authorizedSet = new Set<string>();
                    authorizedSet.add(creatorId);

                    if (status === 'pending_ec_approval' || status === 'pending_faculty_approval') {
                        authorizedSet.add(headApproverId);
                    }
                    if (status === 'pending_faculty_approval') {
                        ecApproverIds.forEach((id) => authorizedSet.add(id));
                    }

                    const expectedCanSend = authorizedSet.has(currentUserId);
                    expect(result.canSend).toBe(expectedCanSend);
                },
            ),
            { numRuns: 200 },
        );
    });
});

// Feature: approval-reminder-system, Property 2: Task Reminder Authorization
// **Validates: Requirements 2.1, 2.2**
describe('Property 2: Task Reminder Authorization', () => {
    it('canSend=true iff user is EC, faculty, or creator for non-completed tasks', () => {
        const userIdArb = fc.stringMatching(/^[a-z0-9]{8}$/);
        const nonCompletedStatus = fc.constantFrom('pending', 'in_progress', 'not_started', 'blocked');

        fc.assert(
            fc.property(
                nonCompletedStatus,
                userIdArb, // currentUserId
                fc.boolean(), // isEC
                fc.boolean(), // isFaculty
                userIdArb, // creatorId
                (taskStatus, currentUserId, isEC, isFaculty, creatorId) => {
                    const members = [makeRecipient('member-1')];

                    const result = getTaskReminderEligibility(
                        taskStatus, currentUserId, isEC, isFaculty, creatorId, members,
                    );

                    const expectedCanSend = isEC || isFaculty || currentUserId === creatorId;
                    expect(result.canSend).toBe(expectedCanSend);
                },
            ),
            { numRuns: 200 },
        );
    });
});
