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

function isAuthUserNotFoundError(message: string | undefined): boolean {
  const m = String(message || '').toLowerCase();
  return m.includes('user not found') || m.includes('user_not_found');
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

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (targetProfileError) {
      return NextResponse.json({ error: targetProfileError.message }, { status: 400 });
    }
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
    if (delError && !isAuthUserNotFoundError(delError.message)) {
      return NextResponse.json({ error: delError.message }, { status: 400 });
    }

    // Keep admin delete robust for legacy/orphan profile rows where auth user no longer exists.
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileDeleteError) {
      return NextResponse.json({ error: profileDeleteError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      authUserMissing: Boolean(delError && isAuthUserNotFoundError(delError.message)),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
