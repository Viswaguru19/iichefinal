import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { DEMO_FLAG_COOKIE } from '@/lib/demo';
import { createDemoAwareFetch } from '@/lib/supabase/demo-fetch';

export async function createClient() {
  const cookieStore = await cookies();
  const demoFetch = createDemoAwareFetch(fetch, {
    cookieIsDemo: () => cookieStore.get(DEMO_FLAG_COOKIE)?.value === '1',
  });

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: demoFetch,
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Handle cookie setting errors (Server Component)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Handle cookie removal errors
          }
        },
      },
    },
  );
}
