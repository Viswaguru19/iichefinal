import { NextResponse } from 'next/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications';
import { appOriginFromRequest, generateTempPassword } from '@/lib/member-password';

export async function POST(request: Request) {
  const generic = {
    success: true,
    message: 'If an account exists, a temporary password was emailed. Sign in with it, then you will be asked to choose a new password.',
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
    if (!profile?.email || !profile.id) return NextResponse.json(generic);

    const tempPassword = generateTempPassword();
    const { error: authError } = await admin.auth.admin.updateUserById(profile.id, {
      password: tempPassword,
    });
    if (authError) {
      console.error('[forgot-password] updateUserById', authError.message);
      return NextResponse.json(generic);
    }

    const { error: flagError } = await admin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', profile.id);
    if (flagError) {
      console.error('[forgot-password] must_change_password', flagError.message);
    }

    const origin = appOriginFromRequest(request);
    const loginUrl = `${origin}/login`;
    const name = String(profile.name || 'there');
    const emailed = await sendEmail(
      profile.email,
      'Your IIChE portal temporary password',
      `<p>Hi ${name},</p>
<p>Here is a temporary password for the IIChE AVVU SC portal:</p>
<p style="font-size:18px;font-weight:700;letter-spacing:0.04em">${tempPassword}</p>
<p>1. Sign in at <a href="${loginUrl}">${loginUrl}</a> with your email or username and this temporary password.</p>
<p>2. You will be asked to choose a new password immediately. That new password is the one to use next time.</p>
<p>If you did not request this, contact a portal admin.</p>`,
      {
        text: `Hi ${name},\n\nTemporary password: ${tempPassword}\n\nSign in at ${loginUrl}, then choose a new password immediately.`,
      },
    );
    if (!emailed.success) {
      console.error('[forgot-password] email', emailed.error);
      return NextResponse.json(
        { error: 'Could not send the email. Ask an admin to issue a temporary password from User Management.' },
        { status: 500 },
      );
    }

    return NextResponse.json(generic);
  } catch (error: unknown) {
    console.error('[forgot-password]', error);
    return NextResponse.json(generic);
  }
}
