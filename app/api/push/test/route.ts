import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasAdminAccess, isPortalAdmin } from '@/lib/permissions';
import { sendWebPushToUsers } from '@/lib/push/send-web-push';

export const runtime = 'nodejs';

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

  const { data: targetProfile } = await createAdminClient()
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
}

/** Admin: list users and whether they have push subscriptions. */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const admin = createAdminClient();
  const [{ data: profiles, error: profilesErr }, { data: subs, error: subsErr }] = await Promise.all([
    admin.from('profiles').select('id, name, email, role').eq('approved', true).order('name'),
    admin.from('push_subscriptions').select('user_id'),
  ]);

  if (profilesErr) return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  if (subsErr) {
    const msg = subsErr.message || 'Failed to load subscriptions';
    const hint = msg.includes('push_subscriptions')
      ? ' Run migration 105_push_subscriptions.sql in Supabase.'
      : '';
    return NextResponse.json({ error: msg + hint }, { status: 500 });
  }

  const subCounts = new Map<string, number>();
  for (const s of subs || []) {
    subCounts.set(s.user_id, (subCounts.get(s.user_id) || 0) + 1);
  }

  const users = (profiles || []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    pushDevices: subCounts.get(p.id) || 0,
    hasPush: (subCounts.get(p.id) || 0) > 0,
  }));

  return NextResponse.json({ users });
}
