import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** Public push setup check — helps debug "failed to send test notification". */
export async function GET() {
  const vapidPublic = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const vapidPrivate = Boolean(process.env.VAPID_PRIVATE_KEY);
  const serviceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  let tableOk = false;
  let subscriptionCount = 0;
  let tableError: string | null = null;

  if (serviceRoleKey) {
    try {
      const admin = createAdminClient();
      const { count, error } = await admin
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true });

      if (error) {
        tableError = error.message;
        if (error.message.includes('push_subscriptions') && error.message.includes('does not exist')) {
          tableError = 'Run migration 105_push_subscriptions.sql in Supabase SQL editor.';
        }
      } else {
        tableOk = true;
        subscriptionCount = count ?? 0;
      }
    } catch (err) {
      tableError = err instanceof Error ? err.message : 'Database check failed';
    }
  } else {
    tableError = 'SUPABASE_SERVICE_ROLE_KEY missing in Vercel environment variables.';
  }

  return NextResponse.json({
    configured: vapidPublic && vapidPrivate && serviceRoleKey && tableOk,
    vapidPublic,
    vapidPrivate,
    serviceRoleKey,
    tableOk,
    subscriptionCount,
    tableError,
    ready: vapidPublic && vapidPrivate && serviceRoleKey && tableOk,
  });
}
