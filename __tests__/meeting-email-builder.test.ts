import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildMeetingNotificationEmail } from '../lib/meeting-email-builder';

// ============================================================
// Unit Tests — buildMeetingNotificationEmail
// ============================================================

describe('buildMeetingNotificationEmail', () => {
    const baseMeeting = {
        id: 'meeting-1',
        title: 'Monthly Review',
        description: 'Discuss progress',
        meeting_date: '2025-03-15T10:00:00Z',
        duration: 60,
    };

    it('online meeting includes meeting link and platform', () => {
        const html = buildMeetingNotificationEmail({
            ...baseMeeting,
            meeting_type: 'online',
            platform: 'google_meet',
            meeting_link: 'https://meet.google.com/abc-def',
            location: null,
        });

        expect(html).toContain('https://meet.google.com/abc-def');
        expect(html).toContain('google meet');
    });

    it('offline meeting includes location', () => {
        const html = buildMeetingNotificationEmail({
            ...baseMeeting,
            meeting_type: 'offline',
            location: 'Room 301',
            platform: null,
            meeting_link: null,
        });

        expect(html).toContain('Room 301');
    });

    it('always includes title, date, and duration', () => {
        const html = buildMeetingNotificationEmail({
            ...baseMeeting,
            meeting_type: 'offline',
            location: 'Auditorium',
            platform: null,
            meeting_link: null,
        });

        expect(html).toContain('Monthly Review');
        expect(html).toContain('60 minutes');
        // Date is formatted via toLocaleString — just check the year is present
        expect(html).toContain('2025');
    });

    it('handles null description gracefully', () => {
        const html = buildMeetingNotificationEmail({
            ...baseMeeting,
            description: null,
            meeting_type: 'offline',
            location: 'Lab',
            platform: null,
            meeting_link: null,
        });

        expect(html).toContain('Monthly Review');
    });

    it('handles null duration gracefully', () => {
        const html = buildMeetingNotificationEmail({
            ...baseMeeting,
            duration: null,
            meeting_type: 'online',
            platform: 'zoom',
            meeting_link: 'https://zoom.us/j/123',
            location: null,
        });

        expect(html).not.toContain('minutes');
    });
});

// ============================================================
// Property-Based Tests
// ============================================================

// Feature: meeting-attendance-system, Property 1: Email content completeness
// **Validates: Requirements 1.2**
describe('Property 1: Email content completeness', () => {
    const meetingArb = fc.record({
        id: fc.uuid(),
        title: fc.string({ minLength: 1, maxLength: 100 }),
        description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
        meeting_type: fc.constantFrom('online' as const, 'offline' as const),
        meeting_date: fc.integer({ min: 1577836800000, max: 1924991999000 }).map(ts => new Date(ts).toISOString()),
        duration: fc.option(fc.integer({ min: 15, max: 480 }), { nil: null }),
        location: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
        platform: fc.option(fc.constantFrom('google_meet', 'zoom', 'teams'), { nil: null }),
        meeting_link: fc.option(fc.webUrl(), { nil: null }),
    });

    it('email HTML always contains title and date year for any meeting', () => {
        fc.assert(
            fc.property(meetingArb, (meeting) => {
                const html = buildMeetingNotificationEmail(meeting);

                // Title must appear in the HTML
                expect(html).toContain(meeting.title);

                // Date year must appear (formatted date always includes the year)
                const year = new Date(meeting.meeting_date).getFullYear().toString();
                expect(html).toContain(year);
            }),
            { numRuns: 150 },
        );
    });

    it('online meetings contain meeting link when provided', () => {
        const onlineMeetingArb = meetingArb.filter(m => m.meeting_type === 'online' && m.meeting_link != null);

        fc.assert(
            fc.property(onlineMeetingArb, (meeting) => {
                const html = buildMeetingNotificationEmail(meeting);
                expect(html).toContain(meeting.meeting_link!);
            }),
            { numRuns: 100 },
        );
    });

    it('offline meetings contain location text', () => {
        const offlineMeetingArb = meetingArb.filter(m => m.meeting_type === 'offline');

        fc.assert(
            fc.property(offlineMeetingArb, (meeting) => {
                const html = buildMeetingNotificationEmail(meeting);
                // Offline always shows location (or TBD if null)
                if (meeting.location) {
                    expect(html).toContain(meeting.location);
                } else {
                    expect(html).toContain('TBD');
                }
            }),
            { numRuns: 100 },
        );
    });
});
