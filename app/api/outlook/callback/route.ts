import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { appOriginFromRequest } from '@/lib/member-password';
import {
  exchangeOutlookCode,
  graphMe,
  mailboxAllowed,
  OUTLOOK_REQUIRED_MAILBOX,
  saveOutlookConnection,
} from '@/lib/outlook-graph';

export async function GET(request: Request) {
  const origin = appOriginFromRequest(request);
  const url = new URL(request.url);
  const jar = await cookies();
  const expectedState = jar.get('outlook_oauth_state')?.value || '';
  const verifier = jar.get('outlook_oauth_verifier')?.value || '';
  const returnTo = jar.get('outlook_oauth_return')?.value || '/dashboard';
  const safeReturn =
    returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';

  const clear = (res: NextResponse) => {
    res.cookies.delete('outlook_oauth_state');
    res.cookies.delete('outlook_oauth_verifier');
    res.cookies.delete('outlook_oauth_return');
    return res;
  };

  const fail = (reason: string) => {
    const target = new URL(safeReturn, origin);
    target.searchParams.set('outlook', 'error');
    target.searchParams.set('outlook_error', reason);
    return clear(NextResponse.redirect(target));
  };

  const error = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (error) return fail(error);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  if (!code || !state || state !== expectedState || !verifier) {
    return fail('Outlook sign-in expired. Try Connect Outlook again.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sign in to the portal first, then connect Outlook.');

  const tokens = await exchangeOutlookCode({ origin, code, codeVerifier: verifier });
  if (!tokens.access_token || !tokens.refresh_token) {
    return fail(tokens.error_description || tokens.error || 'Microsoft did not return a refresh token.');
  }

  try {
    const me = await graphMe(tokens.access_token);
    if (!mailboxAllowed(me.mailbox)) {
      return fail(`Sign in as ${OUTLOOK_REQUIRED_MAILBOX}, not ${me.mailbox || 'a different mailbox'}.`);
    }
    await saveOutlookConnection({
      userId: user.id,
      mailbox: me.mailbox,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: Number(tokens.expires_in) || 3600,
    });
  } catch (err: unknown) {
    return fail(err instanceof Error ? err.message : 'Could not save the Outlook connection');
  }

  const target = new URL(safeReturn, origin);
  target.searchParams.set('tab', 'email');
  target.searchParams.set('outlook', 'connected');
  return clear(NextResponse.redirect(target));
}
