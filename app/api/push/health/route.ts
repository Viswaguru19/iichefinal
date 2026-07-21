import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { vapidKeysMatch } from '@/lib/push/vapid';

export const runtime = 'nodejs';

/** Public push setup check — helps debug "failed to send test notification". */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const vapidPublic = Boolean(publicKey);
  const vapidPrivate = Boolean(privateKey);
  const vapidPairOk =
    vapidPublic && vapidPrivate ? vapidKeysMatch(publicKey, privateKey) : false;
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

  const vapidError =
    vapidPublic && vapidPrivate && !vapidPairOk
      ? 'VAPID public and private keys do not match — regenerate a pair and update both in Vercel.'
      : null;

  const ready = vapidPublic && vapidPrivate && vapidPairOk && serviceRoleKey && tableOk;

  return NextResponse.json({
    configured: ready,
    vapidPublic,
    vapidPrivate,
    vapidPairOk,
    vapidError,
    serviceRoleKey,
    tableOk,
    subscriptionCount,
    tableError,
    ready,
  });
}
