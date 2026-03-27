import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function canDeleteUsers(profile: {
  role: string | null;
  is_faculty: boolean | null;
  is_admin: boolean | null;
} | null): boolean {
  if (!profile) return false;
  return (
    profile.role === 'super_admin' ||
    profile.role === 'faculty_advisor' ||
    profile.is_faculty === true ||
    profile.is_admin === true
  );
}

/** Removes the user from Supabase Auth; profiles and related rows cascade per DB FKs. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();
    if (sessionError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_faculty, is_admin')
      .eq('id', user.id)
      .single();

    if (!canDeleteUsers(profile as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.id === userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !url) {
      return NextResponse.json({ error: 'Server is missing Supabase admin configuration' }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
