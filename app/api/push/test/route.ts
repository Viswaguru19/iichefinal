import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { hasAdminAccess, isPortalAdmin } from '@/lib/permissions';
import { sendWebPushToUsers } from '@/lib/push/send-web-push';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_faculty, is_admin')
    .eq('id', user.id)
    .single();

  if (
    !profile ||
    (!hasAdminAccess(String(profile.role)) && !profile.is_faculty && !isPortalAdmin(profile))
  ) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user };
}

function pushResultError(result: Awaited<ReturnType<typeof sendWebPushToUsers>>): string | null {
  if (result.vapidMissing) {
    return 'VAPID keys missing on server — add them in Vercel and redeploy.';
  }
  if (result.vapidSubjectInvalid || result.deliveryError?.includes('VAPID_SUBJECT')) {
    return 'VAPID_SUBJECT must be mailto:admin@iicheavvu.in (include mailto:) — fix in Vercel env vars and redeploy.';
  }
  if (result.dbError) {
    return result.dbError;
  }
  if (result.noSubscriptions) {
    return 'This user has not enabled notifications. Android: Chrome → Profile → Enable. iPhone: Safari → Add to Home Screen → open app → Profile → Enable.';
  }
  if (result.sent === 0) {
    return (
      result.deliveryError ||
      'Push could not be delivered. Ask the user to open Profile and tap Enable notifications again.'
    );
  }
  return null;
}

/** Admin: send a test push notification to a selected user. */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth && auth.error) return auth.error;

    let body: { userId?: string; message?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: 'Select a user' }, { status: 400 });
    }

    const { data: targetProfile } = await (tryCreateAdminClient() ?? (await createClient()))
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single();
    const name = targetProfile?.name || targetProfile?.email || 'User';

    const result = await sendWebPushToUsers([userId], {
      title: 'IIChE AVVU — Test notification',
      body: body.message?.trim() || `Hi ${name}, push notifications are working on your device.`,
      url: '/dashboard/profile',
      tag: 'admin-test-push',
    });

    const err = pushResultError(result);
    if (err) {
      return NextResponse.json({ error: err, ...result }, { status: result.dbError ? 500 : 502 });
    }

    return NextResponse.json({
      ok: true,
      message: `Test notification sent to ${name} (${result.sent} device${result.sent === 1 ? '' : 's'})`,
      ...result,
    });
  } catch (err) {
    console.error('[push/test] POST failed', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Push API failed unexpectedly — refresh and try again.',
      },
      { status: 500 },
    );
  }
}

/** Admin: list users and whether they have push subscriptions. */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ('error' in auth && auth.error) return auth.error;

    const sessionClient = await createClient();
    const admin = tryCreateAdminClient();
    const db = admin ?? sessionClient;

    const [{ data: profiles, error: profilesErr }, subResult] = await Promise.all([
      db.from('profiles').select('id, name, email, role').eq('approved', true).order('name'),
      db.from('push_subscriptions').select('user_id, user_agent, updated_at'),
    ]);

    if (profilesErr) return NextResponse.json({ error: profilesErr.message }, { status: 500 });

    const subs = subResult.error ? [] : subResult.data;

    const subCounts = new Map<string, number>();
    const subMeta = new Map<string, { userAgent: string | null; updatedAt: string | null }>();
    for (const s of subs || []) {
      subCounts.set(s.user_id, (subCounts.get(s.user_id) || 0) + 1);
      const prev = subMeta.get(s.user_id);
      const updatedAt = s.updated_at || null;
      if (!prev || (updatedAt && (!prev.updatedAt || updatedAt > prev.updatedAt))) {
        subMeta.set(s.user_id, { userAgent: s.user_agent || null, updatedAt });
      }
    }

    const users = (profiles || [])
      .map((p) => {
        const pushDevices = subCounts.get(p.id) || 0;
        const meta = subMeta.get(p.id);
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          pushDevices,
          hasPush: pushDevices > 0,
          pushDeviceHint: meta?.userAgent || null,
          pushUpdatedAt: meta?.updatedAt || null,
        };
      })
      .sort((a, b) => {
        if (a.hasPush !== b.hasPush) return a.hasPush ? -1 : 1;
        return (a.name || a.email || '').localeCompare(b.name || b.email || '');
      });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[push/test] GET failed', err);
    const message =
      err instanceof Error && err.message.includes('admin credentials')
        ? 'SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Add it from Supabase → Project Settings → API, then restart the server.'
        : err instanceof Error
          ? err.message
          : 'Failed to load users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
