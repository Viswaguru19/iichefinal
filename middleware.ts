import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type ProfileGate = {
  hiring_portal_only?: boolean | null;
  approved?: boolean | null;
  role?: string | null;
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public form fill: skip Auth entirely so ~70 concurrent opens do not stampede Supabase Auth / Edge.
  if (path === '/forms' || path.startsWith('/forms/')) {
    return NextResponse.next();
  }

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
    if (path.startsWith('/account-pending')) {
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

    // Hiring-only + approval gate for main dashboard + chat app
    if (
      user &&
      (path.startsWith('/dashboard') || path.startsWith('/chat'))
    ) {
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

    // Protected routes (dashboard, chat app, admin) — allow chat PWA manifest without auth
    const isChatManifest = path === '/chat/manifest.webmanifest';
    if (
      (path.startsWith('/dashboard') ||
        (path.startsWith('/chat') && !isChatManifest) ||
        path.startsWith('/admin')) &&
      !user
    ) {
      const login = new URL('/login', request.url);
      if (path.startsWith('/chat')) {
        login.searchParams.set('next', path + request.nextUrl.search);
      }
      return NextResponse.redirect(login);
    }

    // Redirect if already logged in and trying to access login
    if (path === '/login' && user) {
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
    // Exclude public form fill so Edge never runs Auth for student QR/link opens
    '/((?!_next/static|_next/image|favicon.ico|forms(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
