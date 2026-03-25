import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getCooldownStatus } from '../lib/reminder-eligibility';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// ============================================================
// Unit Tests — getCooldownStatus
// ============================================================

describe('getCooldownStatus', () => {
    it('null lastReminderAt → active=false, remainingSeconds=0', () => {
        const result = getCooldownStatus(null);
        expect(result.active).toBe(false);
        expect(result.remainingSeconds).toBe(0);
    });

    it('5 hours ago → active=true, remainingSeconds > 0', () => {
        const now = new Date();
        const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
        const result = getCooldownStatus(fiveHoursAgo, now);
        expect(result.active).toBe(true);
        expect(result.remainingSeconds).toBeGreaterThan(0);
    });

    it('7 hours ago → active=false, remainingSeconds=0', () => {
        const now = new Date();
        const sevenHoursAgo = new Date(now.getTime() - 7 * 60 * 60 * 1000);
        const result = getCooldownStatus(sevenHoursAgo, now);
        expect(result.active).toBe(false);
        expect(result.remainingSeconds).toBe(0);
    });

    it('exactly 6 hours → active=false', () => {
        const now = new Date();
        const exactlySixHours = new Date(now.getTime() - SIX_HOURS_MS);
        const result = getCooldownStatus(exactlySixHours, now);
        expect(result.active).toBe(false);
        expect(result.remainingSeconds).toBe(0);
    });
});

// ============================================================
// Property-Based Tests
// ============================================================

// Feature: approval-reminder-system, Property 3: Cooldown Enforcement
// **Validates: Requirements 7.1, 7.2**
describe('Property 3: Cooldown Enforcement', () => {
    it('active=true iff elapsed < 6 hours', () => {
        // Generate a "now" and an elapsed time between 0 and 12 hours
        const elapsedMsArb = fc.integer({ min: 0, max: 12 * 60 * 60 * 1000 });

        fc.assert(
            fc.property(elapsedMsArb, (elapsedMs) => {
                const now = new Date(1_700_000_000_000); // fixed reference
                const lastReminderAt = new Date(now.getTime() - elapsedMs);

                const result = getCooldownStatus(lastReminderAt, now);

                const expectedActive = elapsedMs < SIX_HOURS_MS;
                expect(result.active).toBe(expectedActive);

                if (result.active) {
                    expect(result.remainingSeconds).toBeGreaterThan(0);
                    expect(result.remainingSeconds).toBeLessThanOrEqual(6 * 60 * 60);
                } else {
                    expect(result.remainingSeconds).toBe(0);
                }
            }),
            { numRuns: 200 },
        );
    });
});
