import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

    // Hiring-only applicants: no access to main dashboard (committee hiring UI is for full accounts only)
    if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('hiring_portal_only')
        .eq('id', user.id)
        .maybeSingle();
      if ((prof as { hiring_portal_only?: boolean } | null)?.hiring_portal_only) {
        return NextResponse.redirect(new URL('/hiring/portal', request.url));
      }
    }

    // Protected routes (only /dashboard and /admin, not public pages)
    if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin')) {
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // Redirect to dashboard if already logged in and trying to access login
    if (request.nextUrl.pathname === '/login' && user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('hiring_portal_only')
        .eq('id', user.id)
        .maybeSingle();
      const hiringOnly = (prof as { hiring_portal_only?: boolean } | null)?.hiring_portal_only;
      return NextResponse.redirect(
        new URL(hiringOnly ? '/hiring/portal' : '/dashboard', request.url),
      );
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
