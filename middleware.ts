import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type ProfileGate = {
  hiring_portal_only?: boolean | null;
  approved?: boolean | null;
  role?: string | null;
};

const AUTH_BUDGET_MS = 2500;

function withBudget<T>(promise: Promise<T>, ms = AUTH_BUDGET_MS): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, ms);
    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      });
  });
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => {
    const n = c.name;
    return n.includes('auth-token') || (n.startsWith('sb-') && n.includes('auth'));
  });
}

function needsAuthGate(path: string): boolean {
  if (path === '/forms' || path.startsWith('/forms/')) return false;
  if (path === '/chat/manifest.webmanifest') return false;
  if (path === '/login' || path.startsWith('/account-pending')) return true;
  if (path.startsWith('/dashboard') || path.startsWith('/chat') || path.startsWith('/admin')) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public form fill: never touch Auth / profiles (avoids Edge stampede + 504).
  if (path === '/forms' || path.startsWith('/forms/')) {
    return NextResponse.next();
  }

  // Most site traffic does not need Edge Auth — skip entirely (was calling getUser on every page).
  if (!needsAuthGate(path)) {
    return NextResponse.next();
  }

  const isChatManifest = path === '/chat/manifest.webmanifest';
  const isProtected =
    path.startsWith('/dashboard') ||
    (path.startsWith('/chat') && !isChatManifest) ||
    path.startsWith('/admin');

  // No session cookie → redirect protected routes without any Supabase network call.
  if (!hasSupabaseAuthCookie(request)) {
    if (isProtected || path.startsWith('/account-pending')) {
      const login = new URL('/login', request.url);
      if (path.startsWith('/chat')) {
        login.searchParams.set('next', path + request.nextUrl.search);
      }
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
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
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      },
    );

    // Cookie-local session first (no Auth round-trip). Falls back to getUser only if needed.
    const sessionResult = await withBudget(supabase.auth.getSession());
    let user = sessionResult?.data.session?.user ?? null;

    if (!user) {
      const userResult = await withBudget(supabase.auth.getUser());
      user = userResult?.data.user ?? null;
    }

    // Auth hung or failed under load: fail open so dashboard does not 504.
    if (!user) {
      if (isProtected || path.startsWith('/account-pending')) {
        // Cookie existed but Auth timed out — let the page load; client will reconcile.
        return response;
      }
      return response;
    }

    async function loadProfile(): Promise<ProfileGate | null> {
      const result = await withBudget(
        Promise.resolve(
          supabase
            .from('profiles')
            .select('hiring_portal_only, approved, role')
            .eq('id', user!.id)
            .maybeSingle(),
        ),
      );
      return (result?.data as ProfileGate | null) ?? null;
    }

    // /account-pending
    if (path.startsWith('/account-pending')) {
      const p = await loadProfile();
      if (p?.hiring_portal_only) {
        return NextResponse.redirect(new URL('/hiring/portal', request.url));
      }
      if (p?.role === 'super_admin' || p?.approved === true) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return response;
    }

    // Hiring-only + approval gate (skip if profile is slow — avoid 504)
    if (isProtected) {
      const p = await loadProfile();
      if (p) {
        if (p.hiring_portal_only) {
          return NextResponse.redirect(new URL('/hiring/portal', request.url));
        }
        const canUseDashboard = p.role === 'super_admin' || p.approved === true;
        if (!canUseDashboard) {
          return NextResponse.redirect(new URL('/account-pending', request.url));
        }
      }
    }

    if (path === '/login' && user) {
      const p = await loadProfile();
      if (p?.hiring_portal_only) {
        return NextResponse.redirect(new URL('/hiring/portal', request.url));
      }
      const dest =
        p?.role === 'super_admin' || p?.approved === true ? '/dashboard' : '/account-pending';
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
    '/((?!_next/static|_next/image|favicon.ico|forms(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
