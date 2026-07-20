import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn('[Web Push] VAPID keys not configured — skipping push');
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@iicheavvu.in',
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!userIds.length || !ensureConfigured()) {
    return { sent: 0, failed: 0 };
  }

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const admin = createAdminClient();

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', uniqueIds);

  if (error || !subs?.length) {
    return { sent: 0, failed: 0 };
  }

  const pushBody = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushBody,
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  if (staleIds.length) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }

  return { sent, failed };
}
