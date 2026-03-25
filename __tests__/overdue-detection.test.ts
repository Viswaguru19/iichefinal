import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getOverdueStatus } from '../lib/reminder-eligibility';

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

// ============================================================
// Unit Tests — getOverdueStatus
// ============================================================

describe('getOverdueStatus', () => {
    describe('approval', () => {
        it('pending < 48h → pending', () => {
            const now = new Date();
            const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);
            expect(getOverdueStatus('approval', twentyHoursAgo, 'pending_head_approval', now)).toBe('pending');
        });

        it('pending > 48h → overdue', () => {
            const now = new Date();
            const fiftyHoursAgo = new Date(now.getTime() - 50 * 60 * 60 * 1000);
            expect(getOverdueStatus('approval', fiftyHoursAgo, 'pending_ec_approval', now)).toBe('overdue');
        });

        it('active (non-pending) status → normal', () => {
            const now = new Date();
            const longAgo = new Date(now.getTime() - 100 * 60 * 60 * 1000);
            expect(getOverdueStatus('approval', longAgo, 'approved', now)).toBe('normal');
        });
    });

    describe('task', () => {
        it('past deadline → overdue', () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            expect(getOverdueStatus('task', yesterday, 'in_progress', now)).toBe('overdue');
        });

        it('future deadline → pending', () => {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            expect(getOverdueStatus('task', tomorrow, 'in_progress', now)).toBe('pending');
        });

        it('completed → normal', () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            expect(getOverdueStatus('task', yesterday, 'completed', now)).toBe('normal');
        });

        it('null deadline → pending', () => {
            expect(getOverdueStatus('task', null, 'in_progress')).toBe('pending');
        });
    });
});

// ============================================================
// Property-Based Tests
// ============================================================

const PENDING_APPROVAL_STATUSES = [
    'pending_head_approval',
    'pending_ec_approval',
    'pending_faculty_approval',
] as const;

// Feature: approval-reminder-system, Property 8: Overdue Detection
// **Validates: Requirements 9.1, 9.2**
describe('Property 8: Overdue Detection', () => {
    it('overdue classification is consistent with elapsed time and status rules', () => {
        const now = new Date(1_700_000_000_000); // fixed reference

        // Approval sub-property: overdue iff pending AND elapsed > 48h
        const approvalElapsedArb = fc.integer({ min: 0, max: 7 * 24 * 60 * 60 * 1000 }); // 0–7 days
        const approvalStatusArb = fc.constantFrom(
            ...PENDING_APPROVAL_STATUSES,
            'approved', 'rejected', 'draft',
        );

        fc.assert(
            fc.property(approvalElapsedArb, approvalStatusArb, (elapsedMs, status) => {
                const timestamp = new Date(now.getTime() - elapsedMs);
                const result = getOverdueStatus('approval', timestamp, status, now);

                const isPending = (PENDING_APPROVAL_STATUSES as readonly string[]).includes(status);

                if (!isPending) {
                    expect(result).toBe('normal');
                } else if (elapsedMs > FORTY_EIGHT_HOURS_MS) {
                    expect(result).toBe('overdue');
                } else {
                    expect(result).toBe('pending');
                }
            }),
            { numRuns: 200 },
        );

        // Task sub-property: overdue iff not completed AND deadline < now
        const taskElapsedArb = fc.integer({ min: -7 * 24 * 60 * 60 * 1000, max: 7 * 24 * 60 * 60 * 1000 });
        const taskStatusArb = fc.constantFrom('pending', 'in_progress', 'not_started', 'completed');

        fc.assert(
            fc.property(taskElapsedArb, taskStatusArb, (offsetMs, status) => {
                const deadline = new Date(now.getTime() - offsetMs);
                const result = getOverdueStatus('task', deadline, status, now);

                if (status === 'completed') {
                    expect(result).toBe('normal');
                } else if (offsetMs > 0) {
                    // deadline is in the past (now - offsetMs < now when offsetMs > 0)
                    expect(result).toBe('overdue');
                } else {
                    // deadline is in the future or exactly now
                    expect(result).toBe('pending');
                }
            }),
            { numRuns: 200 },
        );
    });
});
