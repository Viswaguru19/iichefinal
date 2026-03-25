import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

// Supabase query builder mock — tracks chained calls (same pattern as create.test.ts)
function createQueryBuilder(resolvedData: any = null, resolvedError: any = null) {
    const builder: any = {
        _calls: [] as { method: string; args: any[] }[],
        select: function (...args: any[]) { this._calls.push({ method: 'select', args }); return this; },
        insert: function (...args: any[]) { this._calls.push({ method: 'insert', args }); return this; },
        eq: function (...args: any[]) { this._calls.push({ method: 'eq', args }); return this; },
        single: function () { this._calls.push({ method: 'single', args: [] }); return { data: resolvedData, error: resolvedError }; },
    };
    builder.then = (resolve: any) => resolve({ data: resolvedData, error: resolvedError });
    return builder;
}

let mockFromHandlers: Record<string, (...args: any[]) => any> = {};

const mockSupabase = {
    auth: {
        getUser: vi.fn(),
    },
    from: vi.fn((table: string) => {
        if (mockFromHandlers[table]) return mockFromHandlers[table](table);
        return createQueryBuilder(null, null);
    }),
} as any;

// ---- Import under test ----
import { checkMeetingAccess } from '@/lib/meeting-access';

// ---- Fixtures ----

const MEETING = {
    id: 'meeting-1',
    title: 'Weekly Standup',
    description: null,
    meeting_date: '2025-08-01T10:00:00Z',
    room_id: 'room-abc',
    created_by: 'creator-user',
    status: 'scheduled',
};

// ---- Tests ----

describe('Meeting room access control', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFromHandlers = {};
    });

    // 1. Unauthenticated users are denied access
    it('denies access when user is not authenticated (getUser returns null)', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
        });

        const result = await checkMeetingAccess(mockSupabase, 'room-abc');

        expect(result.granted).toBe(false);
        expect(result.reason).toBe('unauthenticated');
    });

    it('denies access when getUser returns an auth error', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'JWT expired' },
        });

        const result = await checkMeetingAccess(mockSupabase, 'room-abc');

        expect(result.granted).toBe(false);
        expect(result.reason).toBe('unauthenticated');
    });

    // 2. Non-existent room_id results in access denied
    it('denies access when no meeting exists for the given room_id', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });

        mockFromHandlers = {
            meetings: () => createQueryBuilder(null, { message: 'No rows found' }),
        };

        const result = await checkMeetingAccess(mockSupabase, 'nonexistent-room');

        expect(result.granted).toBe(false);
        expect(result.reason).toBe('meeting_not_found');
    });

    // 3. Meeting creators are granted access
    it('grants access to the meeting creator', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'creator-user' } },
            error: null,
        });

        mockFromHandlers = {
            meetings: () => createQueryBuilder(MEETING, null),
        };

        const result = await checkMeetingAccess(mockSupabase, 'room-abc');

        expect(result.granted).toBe(true);
        expect(result.reason).toBe('granted');
        expect(result.meeting).toEqual(MEETING);
        expect(result.userId).toBe('creator-user');
    });

    // 4. Meeting participants are granted access
    it('grants access to a meeting participant', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'participant-user' } },
            error: null,
        });

        mockFromHandlers = {
            meetings: () => createQueryBuilder(MEETING, null),
            meeting_participants: () => createQueryBuilder({ id: 'mp-1' }, null),
        };

        const result = await checkMeetingAccess(mockSupabase, 'room-abc');

        expect(result.granted).toBe(true);
        expect(result.reason).toBe('granted');
        expect(result.meeting).toEqual(MEETING);
        expect(result.userId).toBe('participant-user');
    });

    // 5. Non-participants are denied access
    it('denies access to a user who is neither creator nor participant', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'random-user' } },
            error: null,
        });

        mockFromHandlers = {
            meetings: () => createQueryBuilder(MEETING, null),
            meeting_participants: () => createQueryBuilder(null, { message: 'No rows found' }),
        };

        const result = await checkMeetingAccess(mockSupabase, 'room-abc');

        expect(result.granted).toBe(false);
        expect(result.reason).toBe('not_participant');
    });
});
