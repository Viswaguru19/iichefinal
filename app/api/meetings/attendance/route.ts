import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isAttendanceManager } from '@/lib/attendance-helpers';

// ---------------------------------------------------------------------------
// GET /api/meetings/attendance?meetingId=<uuid>
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const meetingId = searchParams.get('meetingId');

        if (!meetingId) {
            return NextResponse.json({ error: 'meetingId is required' }, { status: 400 });
        }

        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch caller profile to determine role
        const { data: profile } = await (supabase as any)
            .from('profiles')
            .select('id, executive_role, is_faculty, is_admin')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        const manager = isAttendanceManager(profile);

        if (manager) {
            // Managers see all records with participant profiles
            const { data: records, error } = await (supabase as any)
                .from('meeting_attendance')
                .select('*, user:user_id(id, name, email, role, executive_role)')
                .eq('meeting_id', meetingId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ records: records ?? [], isManager: true });
        }

        // Regular members see only their own record
        const { data: records, error } = await (supabase as any)
            .from('meeting_attendance')
            .select('*')
            .eq('meeting_id', meetingId)
            .eq('user_id', user.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ records: records ?? [], isManager: false });
    } catch (err: any) {
        console.error('GET /api/meetings/attendance error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}


// ---------------------------------------------------------------------------
// POST /api/meetings/attendance
// Body: { meetingId, records: [{ userId, status }], submit?: boolean }
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { meetingId, records, submit } = body;

        if (!meetingId || !Array.isArray(records)) {
            return NextResponse.json(
                { error: 'meetingId and records[] are required' },
                { status: 400 }
            );
        }

        // Validate each record
        for (const r of records) {
            if (!r.userId || !['present', 'absent'].includes(r.status)) {
                return NextResponse.json(
                    { error: 'Each record must have userId and status (present/absent)' },
                    { status: 400 }
                );
            }
        }

        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch caller profile
        const { data: profile } = await (supabase as any)
            .from('profiles')
            .select('id, executive_role, is_faculty, is_admin')
            .eq('id', user.id)
            .single();

        if (!profile || !isAttendanceManager(profile)) {
            return NextResponse.json(
                { error: 'Forbidden: only Attendance Managers can mark attendance' },
                { status: 403 }
            );
        }

        // Check if attendance is already submitted (409 Conflict)
        const { data: existing } = await (supabase as any)
            .from('meeting_attendance')
            .select('submitted')
            .eq('meeting_id', meetingId)
            .eq('submitted', true)
            .limit(1);

        if (existing && existing.length > 0) {
            return NextResponse.json(
                { error: 'Attendance has already been submitted and cannot be modified' },
                { status: 409 }
            );
        }

        // Upsert attendance records
        const upsertRows = records.map((r: { userId: string; status: string }) => ({
            meeting_id: meetingId,
            user_id: r.userId,
            status: r.status,
            marked_by: user.id,
            marked_at: new Date().toISOString(),
            submitted: submit === true,
        }));

        const { error: upsertError } = await (supabase as any)
            .from('meeting_attendance')
            .upsert(upsertRows, { onConflict: 'meeting_id,user_id' });

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        // If submit flag is true, mark all records for this meeting as submitted
        if (submit === true) {
            await (supabase as any)
                .from('meeting_attendance')
                .update({ submitted: true })
                .eq('meeting_id', meetingId);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('POST /api/meetings/attendance error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
