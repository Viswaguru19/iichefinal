import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications';
import { canManageMemberPasswords, generateTempPassword } from '@/lib/member-password';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body?.userId || '').trim();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: actor } = await supabase
      .from('profiles')
      .select('is_admin, is_faculty, role')
      .eq('id', user.id)
      .maybeSingle();
    if (!canManageMemberPasswords(actor)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = tryCreateAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server is missing Supabase admin configuration' }, { status: 500 });
    }

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, name, email')
      .eq('id', userId)
      .maybeSingle();
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 400 });
    if (!target?.email) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const tempPassword = generateTempPassword();
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (authError) {
      return NextResponse.json(
        { error: authError.message || 'Could not update login password. This member may not have an auth account yet.' },
        { status: 400 },
      );
    }

    const { error: flagError } = await admin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId);
    if (flagError) {
      return NextResponse.json({ error: flagError.message }, { status: 400 });
    }

    const name = String(target.name || 'there');
    const emailed = await sendEmail(
      target.email,
      'Your IIChE portal temporary password',
      `<p>Hi ${name},</p>
<p>An admin issued a temporary password for your IIChE AVVU SC portal login.</p>
<p style="font-size:18px;font-weight:700;letter-spacing:0.04em">${tempPassword}</p>
<p>Sign in with this password, then you will be asked to choose a new one immediately.</p>
<p>If you did not expect this, contact your faculty advisor or a portal admin.</p>`,
      { text: `Hi ${name},\n\nTemporary password: ${tempPassword}\n\nSign in, then choose a new password immediately.` },
    );

    return NextResponse.json({
      success: true,
      tempPassword,
      email: target.email,
      emailed: emailed.success === true,
      emailError: emailed.success ? null : emailed.error || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
