import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidVapidSubject, resolveVapidSubject } from '@/lib/push/vapid';

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushSendResult = {
  sent: number;
  failed: number;
  noSubscriptions?: boolean;
  vapidMissing?: boolean;
  vapidSubjectInvalid?: boolean;
  dbError?: string;
  /** Shown when delivery failed — e.g. stale subscription or VAPID mismatch */
  deliveryError?: string;
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
  const subject = resolveVapidSubject(process.env.VAPID_SUBJECT);
  if (!isValidVapidSubject(subject)) {
    console.warn('[Web Push] VAPID subject is not a valid URL:', subject);
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.warn('[Web Push] setVapidDetails failed:', err);
    return false;
  }
  configured = true;
  return true;
}

function describePushError(err: unknown): string {
  const e = err as { statusCode?: number; body?: string; message?: string };
  if (e.message?.includes('not a valid URL') || e.message?.includes('not a valid url')) {
    return 'VAPID_SUBJECT must be mailto:admin@iicheavvu.in — fix in Vercel and redeploy.';
  }
  if (e.message?.includes('timed out')) {
    return 'Push delivery timed out — try again or ask the user to re-enable notifications.';
  }
  if (e.statusCode === 401 || e.statusCode === 403) {
    return 'VAPID key mismatch — user must open Profile and tap Enable notifications again.';
  }
  if (e.statusCode === 404 || e.statusCode === 410) {
    return 'Subscription expired — user must enable notifications again in Profile.';
  }
  return e.body || e.message || 'Unknown push delivery error';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Push delivery timed out')), ms);
    }),
  ]);
}

export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload,
): Promise<PushSendResult> {
  if (!userIds.length) {
    return { sent: 0, failed: 0, noSubscriptions: true };
  }

  if (!ensureConfigured()) {
    const subject = resolveVapidSubject(process.env.VAPID_SUBJECT);
    if (!isValidVapidSubject(subject)) {
      return {
        sent: 0,
        failed: 0,
        vapidSubjectInvalid: true,
        deliveryError:
          'VAPID_SUBJECT must be mailto:admin@iicheavvu.in or https://your-site.in — fix in Vercel env vars.',
      };
    }
    return { sent: 0, failed: 0, vapidMissing: true };
  }

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const admin = createAdminClient();

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', uniqueIds);

  if (error) {
    const msg = error.message || 'Database error';
    const tableMissing = msg.includes('push_subscriptions') && msg.includes('does not exist');
    return {
      sent: 0,
      failed: 0,
      dbError: tableMissing
        ? 'push_subscriptions table missing — run migration 109 in Supabase SQL editor.'
        : msg,
    };
  }

  if (!subs?.length) {
    return { sent: 0, failed: 0, noSubscriptions: true };
  }

  const pushBody = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  let deliveryError: string | undefined;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await withTimeout(
          webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushBody,
          ),
          8000,
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        deliveryError = describePushError(err);
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410 || status === 401 || status === 403) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  if (staleIds.length) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }

  return { sent, failed, deliveryError: sent === 0 ? deliveryError : undefined };
}
