import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend (used by @/lib/notifications → sendEmail)
const mockSend = vi.fn().mockResolvedValue({ id: 'email-1' });
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

// Query builder: await .from().select().eq() resolves to { data, error }
function createQueryBuilder(resolvedData: any = null, resolvedError: any = null) {
  const builder: any = {
    _calls: [] as { method: string; args: any[] }[],
    select: function (...args: any[]) {
      this._calls.push({ method: 'select', args });
      return this;
    },
    eq: function (...args: any[]) {
      this._calls.push({ method: 'eq', args });
      return this;
    },
    or: function (...args: any[]) {
      this._calls.push({ method: 'or', args });
      return this;
    },
    single: function () {
      this._calls.push({ method: 'single', args: [] });
      return { data: resolvedData, error: resolvedError };
    },
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

import { POST } from '@/app/api/meetings/send-invites/route';

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

describe('/api/meetings/send-invites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromHandlers = {};
    process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test_key';
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

  it('returns 400 when meeting has no participants (and no customEmails)', async () => {
    mockFromHandlers = {
      meetings: () => createQueryBuilder(baseMeeting(), null),
      meeting_participants: () => createQueryBuilder([], null),
    };

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no participants/i);
  });

  it('loads meeting_participants with profile emails', async () => {
    const participantsBuilder = createQueryBuilder(
      [{ profiles: { name: 'Alice', email: 'alice@test.com' } }],
      null,
    );
    mockFromHandlers = {
      meetings: () => createQueryBuilder(baseMeeting(), null),
      meeting_participants: () => participantsBuilder,
    };

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const eqCalls = participantsBuilder._calls.filter((c: any) => c.method === 'eq');
    expect(eqCalls.some((c: any) => c.args[0] === 'meeting_id' && c.args[1] === 'meeting-1')).toBe(true);
  });

  it('sends online meeting email via Resend when participants exist', async () => {
    mockFromHandlers = {
      meetings: () =>
        createQueryBuilder(
          baseMeeting({ meeting_type: 'online', meeting_link: 'https://meet.google.com/abc' }),
          null,
        ),
      meeting_participants: () =>
        createQueryBuilder([{ profiles: { name: 'Alice', email: 'alice@test.com' } }], null),
    };

    await POST(makeRequest({ meetingId: 'meeting-1' }));

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('alice@test.com');
    expect(call.html).toContain('View Meeting');
    expect(call.html).toContain('https://meet.google.com/abc');
    expect(call.html).toContain('Online');
  });

  it('sends in-person template with location when offline', async () => {
    mockFromHandlers = {
      meetings: () =>
        createQueryBuilder(
          baseMeeting({
            meeting_type: 'offline',
            location: 'Room 301',
            meeting_link: null,
          }),
          null,
        ),
      meeting_participants: () =>
        createQueryBuilder([{ profiles: { name: 'Bob', email: 'bob@test.com' } }], null),
    };

    await POST(makeRequest({ meetingId: 'meeting-1' }));

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('bob@test.com');
    expect(call.html).toContain('Room 301');
    expect(call.html).toContain('In-Person');
    expect(call.html).toContain('Place:');
    expect(call.html).toContain('Time:');
  });

  it('sends to multiple participants', async () => {
    mockFromHandlers = {
      meetings: () => createQueryBuilder(baseMeeting(), null),
      meeting_participants: () =>
        createQueryBuilder(
          [
            { profiles: { name: 'Alice', email: 'alice@test.com' } },
            { profiles: { name: 'Bob', email: 'bob@test.com' } },
            { profiles: { name: 'Carol', email: 'carol@test.com' } },
          ],
          null,
        ),
    };

    const res = await POST(makeRequest({ meetingId: 'meeting-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toContain('3');
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('sends customEmails when provided (skips meeting_participants)', async () => {
    mockFromHandlers = {
      meetings: () => createQueryBuilder(baseMeeting(), null),
    };

    const res = await POST(
      makeRequest({
        meetingId: 'meeting-1',
        customEmails: ['custom@example.com'],
      }),
    );
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe('custom@example.com');
    // meeting_participants should not be queried when customEmails is non-empty
    expect(mockSupabase.from).not.toHaveBeenCalledWith('meeting_participants');
  });
});
