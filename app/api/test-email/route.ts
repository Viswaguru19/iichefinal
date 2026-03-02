import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications';

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const result = await sendEmail(
    email,
    'Test Email from IIChE AVVU Portal',
    '<h2>Test Email</h2><p>If you received this, email notifications are working! ✅</p>'
  );

  return NextResponse.json(result);
}
