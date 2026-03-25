import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isAttendanceManager } from '../lib/attendance-helpers';

// ============================================================
// Unit Tests — Permission logic
// ============================================================

describe('Attendance API permission logic', () => {
    it('manager profile (executive_role) should be allowed', () => {
        const profile = { executive_role: 'treasurer' as const, is_faculty: false, is_admin: false };
        expect(isAttendanceManager(profile)).toBe(true);
    });

    it('manager profile (is_faculty) should be allowed', () => {
        const profile = { executive_role: null, is_faculty: true, is_admin: false };
        expect(isAttendanceManager(profile)).toBe(true);
    });

    it('manager profile (is_admin) should be allowed', () => {
        const profile = { executive_role: null, is_faculty: false, is_admin: true };
        expect(isAttendanceManager(profile)).toBe(true);
    });

    it('regular profile should be denied', () => {
        const profile = { executive_role: null, is_faculty: false, is_admin: false };
        expect(isAttendanceManager(profile)).toBe(false);
    });

    it('profile with multiple manager flags should be allowed', () => {
        const profile = { executive_role: 'secretary' as const, is_faculty: true, is_admin: true };
        expect(isAttendanceManager(profile)).toBe(true);
    });
});

// ============================================================
// Property-Based Tests
// ============================================================

const EXECUTIVE_ROLES = [
    'secretary',
    'joint_secretary',
    'associate_secretary',
    'associate_joint_secretary',
    'treasurer',
    'associate_treasurer',
] as const;

// Feature: meeting-attendance-system, Property 11: API enforces manager-only write access
// **Validates: Requirements 6.5**
describe('Property 11: API enforces manager-only write access', () => {
    const profileArb = fc.record({
        executive_role: fc.option(fc.constantFrom(...EXECUTIVE_ROLES), { nil: null }),
        is_faculty: fc.boolean(),
        is_admin: fc.boolean(),
    });

    it('isAttendanceManager returns true iff profile has executive_role, is_faculty, or is_admin', () => {
        fc.assert(
            fc.property(profileArb, (profile) => {
                const result = isAttendanceManager(profile);

                const expected =
                    profile.executive_role != null ||
                    profile.is_faculty === true ||
                    profile.is_admin === true;

                expect(result).toBe(expected);
            }),
            { numRuns: 200 },
        );
    });

    it('regular members (no flags) are always denied', () => {
        // Generate profiles that are explicitly regular members
        const regularProfileArb = fc.constant({
            executive_role: null as null,
            is_faculty: false,
            is_admin: false,
        });

        fc.assert(
            fc.property(regularProfileArb, (profile) => {
                expect(isAttendanceManager(profile)).toBe(false);
            }),
            { numRuns: 50 },
        );
    });

    it('any profile with at least one manager flag is always allowed', () => {
        // Generate profiles that have at least one manager flag set
        const managerProfileArb = profileArb.filter(
            p => p.executive_role != null || p.is_faculty || p.is_admin,
        );

        fc.assert(
            fc.property(managerProfileArb, (profile) => {
                expect(isAttendanceManager(profile)).toBe(true);
            }),
            { numRuns: 200 },
        );
    });
});
