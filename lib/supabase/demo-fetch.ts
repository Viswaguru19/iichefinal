import {
  DEMO_READ_ALLOWLIST,
  emailFromBearer,
  isDemoEmail,
  isDemoModeClient,
} from '@/lib/demo';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function emptyRestResponse(preferSingle: boolean): Response {
  const body = preferSingle ? null : [];
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Range': preferSingle ? '*/0' : '0-0/0',
    },
  });
}

function demoBlockedResponse(): Response {
  return new Response(
    JSON.stringify({
      message: 'Demo mode is read-only — real data and changes are disabled.',
      code: 'DEMO_READONLY',
    }),
    { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}

function shouldTreatAsDemo(init?: RequestInit, cookieDemo?: boolean): boolean {
  if (isDemoEmail(emailFromBearer(init?.headers))) return true;
  if (cookieDemo) return true;
  if (typeof window !== 'undefined' && isDemoModeClient()) return true;
  return false;
}

/**
 * Wrap fetch so demo sessions cannot read org data or mutate anything.
 * Auth + allowlisted branding tables still work so the portal UI loads.
 */
export function createDemoAwareFetch(
  baseFetch: typeof fetch = fetch,
  options?: { cookieIsDemo?: () => boolean | Promise<boolean> },
): typeof fetch {
  return async (input, init) => {
    const url = requestUrl(input);
    const method = (init?.method || 'GET').toUpperCase();

    // Always allow GoTrue auth
    if (url.includes('/auth/v1/')) {
      return baseFetch(input, init);
    }

    const cookieDemo = options?.cookieIsDemo ? !!(await options.cookieIsDemo()) : false;
    const demo = shouldTreatAsDemo(init, cookieDemo);
    if (!demo) {
      return baseFetch(input, init);
    }

    // Allow reading public storage objects (logos); block uploads
    if (url.includes('/storage/v1/')) {
      if (method === 'GET' || method === 'HEAD') {
        return baseFetch(input, init);
      }
      return demoBlockedResponse();
    }

    // Realtime HTTP bootstrap — ignore
    if (url.includes('/realtime/v1/')) {
      return baseFetch(input, init);
    }

    if (!url.includes('/rest/v1/')) {
      return baseFetch(input, init);
    }

    // Block all writes / RPCs that mutate
    if (method !== 'GET' && method !== 'HEAD') {
      return demoBlockedResponse();
    }

    // RPC reads → empty
    if (url.includes('/rest/v1/rpc/')) {
      return emptyRestResponse(true);
    }

    const tableMatch = url.match(/\/rest\/v1\/([a-zA-Z0-9_]+)/);
    const table = tableMatch?.[1] || '';
    if (!DEMO_READ_ALLOWLIST.has(table)) {
      const prefer =
        (typeof init?.headers === 'object' &&
          !(init.headers instanceof Headers) &&
          String((init.headers as Record<string, string>)['Accept'] || '').includes('vnd.pgrst.object')) ||
        (init?.headers instanceof Headers && (init.headers.get('Accept') || '').includes('vnd.pgrst.object')) ||
        url.includes('limit=1');
      // Prefer header Prefer: return=representation / Accept object
      let single = false;
      try {
        const h = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers as HeadersInit);
        const accept = h.get('Accept') || '';
        const preferH = h.get('Prefer') || '';
        single = accept.includes('vnd.pgrst.object') || preferH.includes('return=representation') && url.includes('id=eq.');
        if (accept.includes('vnd.pgrst.object')) single = true;
      } catch {
        single = !!prefer;
      }
      return emptyRestResponse(single);
    }

    // profiles / branding — real fetch (demo user only sees own profile via RLS)
    return baseFetch(input, init);
  };
}
