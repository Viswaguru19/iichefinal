import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_USERNAME,
  getDemoPassword,
  isDemoEmail,
} from '@/lib/demo';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ensures the sandboxed demo Auth user + approved profile exist, then returns
 * credentials for the client to sign in (no real org memberships).
 */
export async function POST() {
  try {
    if (process.env.DEMO_LOGIN_DISABLED === '1' || process.env.DEMO_LOGIN_DISABLED === 'true') {
      return NextResponse.json({ error: 'Demo login is disabled' }, { status: 403 });
    }

    const admin = createAdminClient();
    const password = getDemoPassword();

    // Prefer profile lookup (fast) then Auth admin
    let demoUserId: string | null = null;
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', DEMO_EMAIL)
      .maybeSingle();
    if (existingProfile?.id) demoUserId = existingProfile.id;

    if (!demoUserId) {
      for (let page = 1; page <= 5 && !demoUserId; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const found = data.users.find((u) => isDemoEmail(u.email));
        if (found) demoUserId = found.id;
        if (data.users.length < 200) break;
      }
    }

    if (!demoUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { name: DEMO_NAME, demo: true },
      });
      if (createErr) throw createErr;
      demoUserId = created.user.id;
    } else {
      const { error: pwErr } = await admin.auth.admin.updateUserById(demoUserId, {
        password,
        email_confirm: true,
        user_metadata: { name: DEMO_NAME, demo: true },
      });
      if (pwErr) throw pwErr;
    }

    // Approved student/secretary so most portal chrome is visible; data layer still empties lists.
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: demoUserId,
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        username: DEMO_USERNAME,
        role: 'secretary',
        approved: true,
        is_admin: true,
        is_faculty: false,
        hiring_portal_only: false,
        executive_role: null,
      } as Record<string, unknown>,
      { onConflict: 'id' },
    );

    if (profileErr) {
      // Retry with fewer columns if schema differs
      const { error: retryErr } = await admin.from('profiles').upsert(
        {
          id: demoUserId,
          email: DEMO_EMAIL,
          name: DEMO_NAME,
          username: DEMO_USERNAME,
          role: 'student',
          approved: true,
        } as Record<string, unknown>,
        { onConflict: 'id' },
      );
      if (retryErr) throw retryErr;
    }

    // Strip any committee memberships so demo never inherits real org links
    await admin.from('committee_members').delete().eq('user_id', demoUserId);

    return NextResponse.json({
      email: DEMO_EMAIL,
      password,
      ok: true,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to start demo';
    console.error('demo login:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
