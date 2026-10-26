import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createDemoAwareFetch } from '@/lib/supabase/demo-fetch';

let browserClient: SupabaseClient | null = null;
let sessionUser: User | null | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: createDemoAwareFetch(fetch),
      },
    },
  );

  const auth = browserClient.auth;
  const originalGetUser = auth.getUser.bind(auth);
  auth.getUser = (async (...args: Parameters<typeof originalGetUser>) => {
    if (args.length === 0 && sessionUser) {
      return { data: { user: sessionUser }, error: null };
    }
    if (args.length === 0) {
      const { data: { session } } = await auth.getSession();
      if (session?.user) {
        sessionUser = session.user;
        return { data: { user: session.user }, error: null };
      }
    }
    const result = await originalGetUser(...args);
    if (result?.data?.user) sessionUser = result.data.user;
    return result;
  }) as typeof originalGetUser;

  auth.onAuthStateChange((_event, session) => {
    sessionUser = session?.user ?? null;
  });

  return browserClient;
}
