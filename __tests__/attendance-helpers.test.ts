import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isAttendanceManager, computeAttendanceSummary } from '../lib/attendance-helpers';

// ============================================================
// Unit Tests — isAttendanceManager
// ============================================================

describe('isAttendanceManager', () => {
    it('EC member (executive_role set) returns true', () => {
        expect(isAttendanceManager({ executive_role: 'secretary', is_faculty: false, is_admin: false })).toBe(true);
    });

    it('faculty returns true', () => {
        expect(isAttendanceManager({ executive_role: null, is_faculty: true, is_admin: false })).toBe(true);
    });

    it('admin returns true', () => {
        expect(isAttendanceManager({ executive_role: null, is_faculty: false, is_admin: true })).toBe(true);
    });

    it('regular member returns false', () => {
        expect(isAttendanceManager({ executive_role: null, is_faculty: false, is_admin: false })).toBe(false);
    });
});

// ============================================================
// Unit Tests — computeAttendanceSummary
// ============================================================

describe('computeAttendanceSummary', () => {
    const participants = [
        { id: 'u1', name: 'Alice', role: 'member', committeeName: 'Tech' },
        { id: 'u2', name: 'Bob', role: 'head', committeeName: 'Events' },
        { id: 'u3', name: 'Charlie', role: 'member', committeeName: null },
    ];

    it('returns correct counts', () => {
        const records = [
            { user_id: 'u1', status: 'present' as const },
            { user_id: 'u2', status: 'absent' as const },
            { user_id: 'u3', status: 'present' as const },
        ];

        const summary = computeAttendanceSummary(records, participants);
        expect(summary.presentCount).toBe(2);
        expect(summary.absentCount).toBe(1);
    });

    it('returns correct present and absent lists', () => {
        const records = [
            { user_id: 'u1', status: 'present' as const },
            { user_id: 'u2', status: 'absent' as const },
            { user_id: 'u3', status: 'absent' as const },
        ];

        const summary = computeAttendanceSummary(records, participants);
        expect(summary.presentList).toEqual([{ name: 'Alice' }]);
        expect(summary.absentList).toEqual([
            { name: 'Bob', committeeName: 'Events', role: 'head' },
            { name: 'Charlie', committeeName: null, role: 'member' },
        ]);
    });

    it('participants without records default to absent', () => {
        const summary = computeAttendanceSummary([], participants);
        expect(summary.absentCount).toBe(3);
        expect(summary.presentCount).toBe(0);
    });
});

// ============================================================
// Property-Based Tests
// ============================================================

// Feature: meeting-attendance-system, Property 10: Attendance summary counts
// **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
describe('Property 10: Attendance summary counts', () => {
    const participantArb = fc.uniqueArray(
        fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            role: fc.constantFrom('member', 'head', 'co_head'),
            committeeName: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
        }),
        { minLength: 1, maxLength: 20, selector: (p) => p.id },
    );

    it('presentCount + absentCount always equals total participants', () => {
        fc.assert(
            fc.property(participantArb, (participants) => {
                // Generate random attendance records for a subset of participants
                const statusArb = fc.constantFrom('present' as const, 'absent' as const);
                const records = participants.map(p => ({
                    user_id: p.id,
                    status: fc.sample(statusArb, 1)[0],
                }));

                const summary = computeAttendanceSummary(records, participants);
                expect(summary.presentCount + summary.absentCount).toBe(participants.length);
            }),
            { numRuns: 200 },
        );
    });

    it('present list contains only present members and absent list contains only absent members', () => {
        fc.assert(
            fc.property(participantArb, (participants) => {
                const statusArb = fc.constantFrom('present' as const, 'absent' as const);
                const records = participants.map(p => ({
                    user_id: p.id,
                    status: fc.sample(statusArb, 1)[0],
                }));

                const summary = computeAttendanceSummary(records, participants);

                // Every name in presentList should correspond to a present record
                const presentIds = new Set(records.filter(r => r.status === 'present').map(r => r.user_id));
                const absentIds = new Set(
                    participants.filter(p => !presentIds.has(p.id)).map(p => p.id),
                );

                expect(summary.presentList.length).toBe(presentIds.size);
                expect(summary.absentList.length).toBe(absentIds.size);
            }),
            { numRuns: 200 },
        );
    });
});
