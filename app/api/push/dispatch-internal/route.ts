import { NextResponse } from 'next/server';
import { sendWebPushToUsers } from '@/lib/push/send-web-push';

/** Internal webhook: push for any notification insert (optional DB trigger). */
export async function POST(request: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string; title?: string; body?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.userId || !body.title || !body.body) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const result = await sendWebPushToUsers([body.userId], {
    title: body.title,
    body: body.body,
    url: body.url || '/dashboard',
  });

  return NextResponse.json({ ok: true, ...result });
}
