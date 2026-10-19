import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = (request.nextUrl.searchParams.get('type') || 'recovery') as EmailOtpType;
  const next = '/reset-password';
  const destination = new URL(next, request.url);

  if (!tokenHash) {
    destination.searchParams.set('error', 'missing');
    return NextResponse.redirect(destination);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    destination.searchParams.set('error', 'config');
    return NextResponse.redirect(destination);
  }

  let response = NextResponse.redirect(destination);
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.redirect(destination);
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.redirect(destination);
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    const failed = new URL('/reset-password', request.url);
    failed.searchParams.set('error', 'invalid');
    return NextResponse.redirect(failed);
  }

  return response;
}
