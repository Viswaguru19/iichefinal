import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type ProfileGate = {
  hiring_portal_only?: boolean | null;
  approved?: boolean | null;
  role?: string | null;
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('Supabase env vars missing - skipping middleware auth checks');
      return response;
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // /account-pending: only for logged-in users who are not yet approved
    if (request.nextUrl.pathname.startsWith('/account-pending')) {
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('hiring_portal_only, approved, role')
        .eq('id', user.id)
        .maybeSingle();
      const p = prof as ProfileGate | null;
      if (p?.hiring_portal_only) {
        return NextResponse.redirect(new URL('/hiring/portal', request.url));
      }
      if (p?.role === 'super_admin' || p?.approved === true) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Hiring-only + approval gate for main dashboard
    if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('hiring_portal_only, approved, role')
        .eq('id', user.id)
        .maybeSingle();
      const p = prof as ProfileGate | null;
      if (p?.hiring_portal_only) {
        return NextResponse.redirect(new URL('/hiring/portal', request.url));
      }
      const canUseDashboard =
        p?.role === 'super_admin' ||
        p?.approved === true;
      if (!canUseDashboard) {
        return NextResponse.redirect(new URL('/account-pending', request.url));
      }
    }

    // Protected routes (only /dashboard and /admin, not public pages)
    if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin')) {
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // Redirect if already logged in and trying to access login
    if (request.nextUrl.pathname === '/login' && user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('hiring_portal_only, approved, role')
        .eq('id', user.id)
        .maybeSingle();
      const p = prof as ProfileGate | null;
      if (p?.hiring_portal_only) {
        return NextResponse.redirect(new URL('/hiring/portal', request.url));
      }
      const dest =
        p?.role === 'super_admin' || p?.approved === true
          ? '/dashboard'
          : '/account-pending';
      return NextResponse.redirect(new URL(dest, request.url));
    }

    return response;
  } catch (err) {
    console.error('Middleware error - allowing request to proceed', err);
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
