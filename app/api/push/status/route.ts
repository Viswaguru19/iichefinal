import { NextResponse } from 'next/server';

/** Public status check — tells the profile UI whether server-side push is configured. */
export async function GET() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const hasPublic = Boolean(vapidPublicKey);
  const hasPrivate = Boolean(process.env.VAPID_PRIVATE_KEY);
  const hasWebhook = Boolean(process.env.PUSH_WEBHOOK_SECRET);

  return NextResponse.json({
    configured: hasPublic && hasPrivate,
    vapidPublic: hasPublic,
    vapidPrivate: hasPrivate,
    vapidPublicKey: vapidPublicKey || null,
    webhookSecret: hasWebhook,
    /** Full auto-push on every notification insert needs migration 110 + Supabase DB settings. */
    autoDispatchReady: hasPublic && hasPrivate && hasWebhook,
  });
}
