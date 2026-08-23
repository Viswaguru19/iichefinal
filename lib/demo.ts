/** Demo / try-the-portal mode — explore UI with no real org data. */

export const DEMO_EMAIL = 'demo@iiche-avvu.local';
export const DEMO_USERNAME = 'demo';
export const DEMO_NAME = 'Demo Visitor';
export const DEMO_FLAG_COOKIE = 'portal-demo';
export const DEMO_FLAG_LS = 'portal-demo';

/** Default password used when auto-provisioning the demo Auth user (override with DEMO_PASSWORD). */
export const DEMO_PASSWORD_DEFAULT = 'DemoPortalVisit2026!';

export function getDemoPassword(): string {
  return process.env.DEMO_PASSWORD || DEMO_PASSWORD_DEFAULT;
}

export function isDemoEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === DEMO_EMAIL;
}

export function isDemoModeClient(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(DEMO_FLAG_LS) === '1') return true;
  } catch {
    /* ignore */
  }
  try {
    return document.cookie.split(';').some((c) => c.trim().startsWith(`${DEMO_FLAG_COOKIE}=1`));
  } catch {
    return false;
  }
}

export function setDemoFlagClient(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (on) localStorage.setItem(DEMO_FLAG_LS, '1');
    else localStorage.removeItem(DEMO_FLAG_LS);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = on
      ? `${DEMO_FLAG_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
      : `${DEMO_FLAG_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** Tables the demo account may still read (own profile / branding only). */
export const DEMO_READ_ALLOWLIST = new Set([
  'profiles',
  'logo_settings',
  'portal_logos',
  'logos',
  'app_settings',
  'site_settings',
]);

export function emailFromBearer(headers?: HeadersInit | null): string | null {
  if (!headers) return null;
  try {
    const h = headers instanceof Headers ? headers : new Headers(headers as HeadersInit);
    const auth = h.get('Authorization') || h.get('authorization');
    if (!auth?.toLowerCase().startsWith('bearer ')) return null;
    const token = auth.slice(7).trim();
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}
