import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

// Mock Resend
const mockSend = vi.fn().mockResolvedValue({ id: 'email-1' });
vi.mock('resend', () => ({
    Resend: class MockResend {
        emails = { send: mockSend };
    },
}));

// Supabase query builder mock
function createQueryBuilder(resolvedData: any = null, resolvedError: any = null) {
    const builder: any = {
        _calls: [] as { method: string; args: any[] }[],
        select: function (...args: any[]) { this._calls.push({ method: 'select', args }); return this; },
        eq: function (...args: any[]) { this._calls.push({ method: 'eq', args }); return this; },
        not: function (...args: any[]) { this._calls.push({ method: 'not', args }); return this; },
        single: function () { this._calls.push({ method: 'single', args: [] }); return { data: resolvedData, error: resolvedError }; },
    };
    builder.then = (resolve: any) => resolve({ data: resolvedData, error: resolvedError });
    return builder;
}

let mockFromHandlers: Record<string, (...args: any[]) => any> = {};

const mockSupabase = {
    from: vi.fn((table: string) => {
        if (mockFromHandlers[table]) return mockFromHandlers[table](table);
        return createQueryBuilder([], null);
    }),
};

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

import { POST } from '@/app/api/meetings/send-invites/route';

// ---- Helpers ----

function makeRequest(body: Record<string, any>): Request {
    return new Request('http://localhost:3000/api/meetings/send-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function baseMeeting(overrides: Record<string, any> = {}) {
    return {
        id: 'meeting-1',
        title: 'Weekly Standup',
        description: 'Team sync',
        meeting_type: 'online',
        meeting_date: new Date(Date.now() + 86400000).toISOString(),
        duration: 60,
        platform: 'google_meet',
        meeting_link: 'https://meet.google.com/abc',
        location: null,
        venue_details: null,
        audience_type: 'all_members',
        committee_id: null,
        agenda: 'Discuss progress',
        creator: { name: 'Admin', email: 'admin@test.com' },
        committee: null,
        ...overrides,
    };
}

// ---- Tests ----

describe('/api/meetings/send-invites', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFromHandlers = {};
    });

    it('returns 404 when meeting is not found', async () => {
        mockFromHandlers = {
            meetings: () => createQueryBuilder(null, null),
        };

        const res = await POST(makeRequest({ meetingId: 'nonexistent' }));
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toMatch(/not found/i);
    });

    it('returns 400 when no participants are resolved', async () => {
        mockFromHandlers = {
            meetings: () => createQueryBuilder(baseMeeting(), null),
            profiles: () => createQueryBuilder([], null),
        };

        const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/no participants/i);
    });

    describe('Audience Resolution', () => {
        it('resolves all_members from profiles where is_active=true', async () => {
            const profilesBuilder = createQueryBuilder(
                [{ name: 'Alice', email: 'alice@test.com' }],
                null
            );
            mockFromHandlers = {
                meetings: () => createQueryBuilder(baseMeeting({ audience_type: 'all_members' }), null),
                profiles: () => profilesBuilder,
            };

            const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
            expect(res.status).toBe(200);

            const eqCalls = profilesBuilder._calls.filter((c: any) => c.method === 'eq');
            expect(eqCalls).toEqual(
                expect.arrayContaining([expect.objectContaining({ args: ['is_active', true] })])
            );
        });

        it('resolves alumni from profiles where member_type=alumni', async () => {
            const profilesBuilder = createQueryBuilder(
                [{ name: 'Bob', email: 'bob@test.com' }],
                null
            );
            mockFromHandlers = {
                meetings: () => createQueryBuilder(baseMeeting({ audience_type: 'alumni' }), null),
                profiles: () => profilesBuilder,
            };

            const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
            expect(res.status).toBe(200);

            const eqCalls = profilesBuilder._calls.filter((c: any) => c.method === 'eq');
            expect(eqCalls).toEqual(
                expect.arrayContaining([expect.objectContaining({ args: ['member_type', 'alumni'] })])
            );
        });

        it('resolves executive_committee from profiles where executive_role IS NOT NULL', async () => {
            const profilesBuilder = createQueryBuilder(
                [{ name: 'Carol', email: 'carol@test.com' }],
                null
            );
            mockFromHandlers = {
                meetings: () => createQueryBuilder(baseMeeting({ audience_type: 'executive_committee' }), null),
                profiles: () => profilesBuilder,
            };

            const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
            expect(res.status).toBe(200);

            const notCalls = profilesBuilder._calls.filter((c: any) => c.method === 'not');
            expect(notCalls).toEqual(
                expect.arrayContaining([expect.objectContaining({ args: ['executive_role', 'is', null] })])
            );
        });

        it('resolves specific_committee from committee_members', async () => {
            const committeeBuilder = createQueryBuilder(
                [{ profiles: { name: 'Dave', email: 'dave@test.com' } }],
                null
            );
            mockFromHandlers = {
                meetings: () => createQueryBuilder(
                    baseMeeting({ audience_type: 'specific_committee', committee_id: 'comm-1' }),
                    null
                ),
                committee_members: () => committeeBuilder,
            };

            const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
            expect(res.status).toBe(200);

            const eqCalls = committeeBuilder._calls.filter((c: any) => c.method === 'eq');
            expect(eqCalls).toEqual(
                expect.arrayContaining([expect.objectContaining({ args: ['committee_id', 'comm-1'] })])
            );
        });
    });

    describe('Email Templates', () => {
        it('sends online template with "Join Meeting" button for online meetings', async () => {
            mockFromHandlers = {
                meetings: () => createQueryBuilder(
                    baseMeeting({ meeting_type: 'online', meeting_link: 'https://meet.google.com/abc' }),
                    null
                ),
                profiles: () => createQueryBuilder(
                    [{ name: 'Alice', email: 'alice@test.com' }],
                    null
                ),
            };

            await POST(makeRequest({ meetingId: 'meeting-1' }));

            expect(mockSend).toHaveBeenCalledTimes(1);
            const call = mockSend.mock.calls[0][0];
            expect(call.to).toBe('alice@test.com');
            expect(call.html).toContain('Join Meeting');
            expect(call.html).toContain('https://meet.google.com/abc');
            expect(call.html).toContain('Online');
            expect(call.html).not.toContain('Venue Details');
        });

        it('sends in-person template with location and venue_details, no join button', async () => {
            mockFromHandlers = {
                meetings: () => createQueryBuilder(
                    baseMeeting({
                        meeting_type: 'offline',
                        location: 'Room 301',
                        venue_details: 'Third floor, Main Building',
                        meeting_link: null,
                    }),
                    null
                ),
                profiles: () => createQueryBuilder(
                    [{ name: 'Bob', email: 'bob@test.com' }],
                    null
                ),
            };

            await POST(makeRequest({ meetingId: 'meeting-1' }));

            expect(mockSend).toHaveBeenCalledTimes(1);
            const call = mockSend.mock.calls[0][0];
            expect(call.to).toBe('bob@test.com');
            expect(call.html).toContain('In-Person');
            expect(call.html).toContain('Room 301');
            expect(call.html).toContain('Third floor, Main Building');
            expect(call.html).not.toContain('Join Meeting');
        });

        it('sends emails to multiple participants', async () => {
            mockFromHandlers = {
                meetings: () => createQueryBuilder(baseMeeting(), null),
                profiles: () => createQueryBuilder(
                    [
                        { name: 'Alice', email: 'alice@test.com' },
                        { name: 'Bob', email: 'bob@test.com' },
                        { name: 'Carol', email: 'carol@test.com' },
                    ],
                    null
                ),
            };

            const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.message).toContain('3');
            expect(mockSend).toHaveBeenCalledTimes(3);
        });
    });
});
