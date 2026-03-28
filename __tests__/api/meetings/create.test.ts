import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

// Mock nanoid
vi.mock('nanoid', () => ({
    nanoid: () => 'mock-room-id-123',
}));

// Supabase query builder mock — tracks chained calls
function createQueryBuilder(resolvedData: any = null, resolvedError: any = null) {
    const builder: any = {
        _calls: [] as { method: string; args: any[] }[],
        select: function (...args: any[]) { this._calls.push({ method: 'select', args }); return this; },
        insert: function (...args: any[]) { this._calls.push({ method: 'insert', args }); return this; },
        eq: function (...args: any[]) { this._calls.push({ method: 'eq', args }); return this; },
        not: function (...args: any[]) { this._calls.push({ method: 'not', args }); return this; },
        single: function () { this._calls.push({ method: 'single', args: [] }); return { data: resolvedData, error: resolvedError }; },
    };
    // For non-single terminal calls, make the builder itself thenable
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
        return createQueryBuilder([], null);
    }),
};

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock next/headers (required by supabase server client)
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
    })),
}));

// Import the handler after mocks are set up
import { POST } from '@/app/api/meetings/create/route';

// ---- Helpers ----

function futureDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
}

function makeRequest(body: Record<string, any>, origin = 'http://localhost:3000'): Request {
    return new Request('http://localhost:3000/api/meetings/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            origin,
        },
        body: JSON.stringify(body),
    });
}

function validBody(overrides: Record<string, any> = {}): Record<string, any> {
    return {
        title: 'Weekly Standup',
        meeting_type: 'online',
        platform: 'google_meet',
        meeting_date: futureDate(),
        duration: 60,
        audience_type: 'all_members',
        ...overrides,
    };
}

// ---- Tests ----

describe('/api/meetings/create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFromHandlers = {};

        // Default: authenticated user
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });
    });

    // =====================
    // Validation Tests
    // =====================

    describe('Validation', () => {
        it('returns 401 when user is not authenticated', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: { message: 'Not authenticated' },
            });

            const res = await POST(makeRequest(validBody()));
            expect(res.status).toBe(401);
            const json = await res.json();
            expect(json.error).toBe('Unauthorized');
        });

        it('returns 400 when title is missing', async () => {
            const res = await POST(makeRequest(validBody({ title: '' })));
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toMatch(/title/i);
        });

        it('returns 400 when meeting_date is in the past', async () => {
            const pastDate = new Date('2020-01-01T00:00:00Z').toISOString();
            const res = await POST(makeRequest(validBody({ meeting_date: pastDate })));
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toMatch(/future/i);
        });

        it('returns 400 when duration is non-positive', async () => {
            const res = await POST(makeRequest(validBody({ duration: 0 })));
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toMatch(/duration/i);
        });

        it('returns 400 when offline meeting has no location', async () => {
            const res = await POST(makeRequest(validBody({
                meeting_type: 'offline',
                location: '',
            })));
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toMatch(/location/i);
        });

        it('returns 400 when specific_committee has no committee_id', async () => {
            const res = await POST(makeRequest(validBody({
                audience_type: 'specific_committee',
                committee_id: undefined,
            })));
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error).toMatch(/committee/i);
        });
    });

    // =====================
    // Audience Resolution Tests
    // =====================

    describe('Audience Resolution', () => {
        // Helper: set up mocks so meeting insert succeeds and we can inspect audience queries
        function setupMeetingInsertSuccess() {
            const profilesQueryBuilder = createQueryBuilder(
                [{ id: 'p1' }, { id: 'p2' }],
                null
            );
            const committeeQueryBuilder = createQueryBuilder(
                [{ user_id: 'c1' }, { user_id: 'c2' }],
                null
            );

            // Track which table + method combos were called
            const queryCalls: { table: string; builder: any }[] = [];

            mockFromHandlers = {
                meetings: () => {
                    const b = createQueryBuilder(
                        { id: 'meeting-1', title: 'Test' },
                        null
                    );
                    return b;
                },
                meeting_rooms: () => createQueryBuilder(null, null),
                meeting_participants: () => createQueryBuilder(null, null),
                profiles: () => {
                    queryCalls.push({ table: 'profiles', builder: profilesQueryBuilder });
                    return profilesQueryBuilder;
                },
                committee_members: () => {
                    queryCalls.push({ table: 'committee_members', builder: committeeQueryBuilder });
                    return committeeQueryBuilder;
                },
            };

            // Stub global fetch for email dispatch
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

            return { queryCalls, profilesQueryBuilder, committeeQueryBuilder };
        }

        it('all_members queries profiles with is_active=true', async () => {
            const { queryCalls, profilesQueryBuilder } = setupMeetingInsertSuccess();

            await POST(makeRequest(validBody({ audience_type: 'all_members' })));

            expect(queryCalls.some(c => c.table === 'profiles')).toBe(true);
            const eqCalls = profilesQueryBuilder._calls.filter(
                (c: any) => c.method === 'eq'
            );
            expect(eqCalls).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ args: ['is_active', true] }),
                ])
            );
        });

        it('general audience does not query profiles for participant resolution', async () => {
            const { queryCalls } = setupMeetingInsertSuccess();

            await POST(makeRequest(validBody({ audience_type: 'general' })));

            expect(queryCalls.some(c => c.table === 'profiles')).toBe(false);
        });

        it('executive_committee queries profiles where executive_role IS NOT NULL', async () => {
            const { queryCalls, profilesQueryBuilder } = setupMeetingInsertSuccess();

            await POST(makeRequest(validBody({ audience_type: 'executive_committee' })));

            expect(queryCalls.some(c => c.table === 'profiles')).toBe(true);
            const notCalls = profilesQueryBuilder._calls.filter(
                (c: any) => c.method === 'not'
            );
            expect(notCalls).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ args: ['executive_role', 'is', null] }),
                ])
            );
        });

        it('specific_committee queries committee_members with committee_id', async () => {
            const { queryCalls, committeeQueryBuilder } = setupMeetingInsertSuccess();

            await POST(makeRequest(validBody({
                audience_type: 'specific_committee',
                committee_id: 'comm-42',
            })));

            expect(queryCalls.some(c => c.table === 'committee_members')).toBe(true);
            const eqCalls = committeeQueryBuilder._calls.filter(
                (c: any) => c.method === 'eq'
            );
            expect(eqCalls).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ args: ['committee_id', 'comm-42'] }),
                ])
            );
        });

        it('accepts valid optional room_id for online meetings', async () => {
            setupMeetingInsertSuccess();
            const res = await POST(
                makeRequest(validBody({ room_id: 'abcdefghijklmnop12345' })),
            );
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.room_id).toBe('abcdefghijklmnop12345');
            expect(String(json.meeting_link || '')).toContain('/meet/abcdefghijklmnop12345');
        });
    });
});
