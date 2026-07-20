import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWebPushToUsers } from '@/lib/push/send-web-push';

type DispatchItem = {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { items?: DispatchItem[]; userIds?: string[]; title?: string; body?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const batches: DispatchItem[] = [];

  if (body.items?.length) {
    batches.push(...body.items);
  } else if (body.userIds?.length && body.title && body.body) {
    for (const userId of body.userIds) {
      batches.push({ userId, title: body.title, body: body.body, url: body.url });
    }
  }

  if (!batches.length) {
    return NextResponse.json({ error: 'Nothing to dispatch' }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;

  const grouped = new Map<string, DispatchItem>();
  for (const item of batches) {
    if (!item.userId || !item.title) continue;
    grouped.set(`${item.userId}:${item.title}:${item.body}`, item);
  }

  for (const item of grouped.values()) {
    const result = await sendWebPushToUsers([item.userId], {
      title: item.title,
      body: item.body,
      url: item.url,
      tag: item.tag,
    });
    sent += result.sent;
    failed += result.failed;
  }

  return NextResponse.json({ ok: true, sent, failed });
}
