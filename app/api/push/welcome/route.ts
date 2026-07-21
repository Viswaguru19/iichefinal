import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWebPushToUsers } from '@/lib/push/send-web-push';

/** Send a welcome push to the current user right after they enable notifications. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendWebPushToUsers([user.id], {
    title: 'IIChE AVVU — Notifications on',
    body: 'You will receive portal alerts on this device.',
    url: '/dashboard/profile',
    tag: 'welcome-push',
  });

  return NextResponse.json({ ok: true, ...result });
}
