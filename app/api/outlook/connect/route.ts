import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appOriginFromRequest } from '@/lib/member-password';
import { canSendEventParticipantEmail } from '@/lib/member-profile-edit';
import { outlookAuthorizeUrl, outlookEnvReady } from '@/lib/outlook-graph';

function base64Url(buffer: Buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function canConnect(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_faculty, is_admin, role, committee_members(committees(name))')
    .eq('id', userId)
    .single();
  return canSendEventParticipantEmail(profile, profile?.committee_members);
}

export async function GET(request: Request) {
  const origin = appOriginFromRequest(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', origin));
  }
  if (!(await canConnect(supabase, user.id))) {
    return NextResponse.redirect(new URL('/dashboard?outlook=forbidden', origin));
  }
  if (!outlookEnvReady()) {
    return NextResponse.redirect(new URL('/dashboard?outlook=not-configured', origin));
  }

  const returnTo = new URL(request.url).searchParams.get('returnTo') || '/dashboard';
  const safeReturn =
    returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  const state = base64Url(randomBytes(24));

  const authorize = outlookAuthorizeUrl(origin, state, challenge);
  const res = NextResponse.redirect(authorize);
  const cookie = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 600, secure: origin.startsWith('https') };
  res.cookies.set('outlook_oauth_state', state, cookie);
  res.cookies.set('outlook_oauth_verifier', verifier, cookie);
  res.cookies.set('outlook_oauth_return', safeReturn, cookie);
  return res;
}
