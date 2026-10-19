import { NextResponse } from 'next/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications';
import { appOriginFromRequest } from '@/lib/member-password';

export async function POST(request: Request) {
  const generic = {
    success: true,
    message: 'If an account exists, a reset link was sent to the registered email.',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const identifier = String(body?.emailOrUsername || body?.email || '').trim();
    if (!identifier) {
      return NextResponse.json({ error: 'Email or username is required' }, { status: 400 });
    }

    const admin = tryCreateAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Password reset is not configured on the server' }, { status: 500 });
    }

    let query = admin.from('profiles').select('id, name, email').limit(1);
    if (identifier.includes('@')) {
      query = query.ilike('email', identifier);
    } else {
      query = query.ilike('username', identifier);
    }
    const { data: profile } = await query.maybeSingle();
    if (!profile?.email) return NextResponse.json(generic);

    const origin = appOriginFromRequest(request);
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo },
    });
    if (error) {
      console.error('[forgot-password] generateLink', error.message);
      return NextResponse.json(generic);
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) return NextResponse.json(generic);

    const name = String(profile.name || 'there');
    await sendEmail(
      profile.email,
      'Reset your IIChE portal password',
      `<p>Hi ${name},</p>
<p>We received a request to reset your IIChE AVVU SC portal password.</p>
<p><a href="${actionLink}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Choose a new password</a></p>
<p>If the button does not work, copy this link:</p>
<p style="word-break:break-all">${actionLink}</p>
<p>If you did not request this, you can ignore the email.</p>`,
      {
        text: `Hi ${name},\n\nReset your password: ${actionLink}\n\nIf you did not request this, ignore this email.`,
      },
    );

    return NextResponse.json(generic);
  } catch (error: unknown) {
    console.error('[forgot-password]', error);
    return NextResponse.json(generic);
  }
}
