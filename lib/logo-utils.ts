/** Bundled chapter logo in /public — used on first paint, no remote fetch. */
export const DEFAULT_PORTAL_LOGO = '/logo.png';

/** Storage filename of the logo that was copied into /public/logo.png. */
const BUNDLED_STORAGE_LOGO = 'logo-1772647593546.png';

export const LOGO_CACHE_KEY = 'portal-logo-url-v4';

export type ActiveLogoRecord = {
  id: string;
  logo_url: string;
  uploaded_at: string;
};

/**
 * Resolve a logo_settings.logo_url value to a browser-loadable URL.
 * Pass getStoragePublicUrl from Supabase storage when the path is in the logos bucket.
 */
export function resolveLogoPublicUrl(
  logoUrl: string | null | undefined,
  getStoragePublicUrl?: (storagePath: string) => string,
): string {
  if (!logoUrl) return DEFAULT_PORTAL_LOGO;

  if (
    logoUrl === 'logo.svg' ||
    logoUrl === '/logo.svg' ||
    logoUrl === 'logo.png' ||
    logoUrl.endsWith('/logo.png') ||
    logoUrl.includes(BUNDLED_STORAGE_LOGO)
  ) {
    return DEFAULT_PORTAL_LOGO;
  }

  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl;
  }

  // Stored as "logos/filename.png" — file lives in the logos storage bucket
  if (logoUrl.startsWith('logos/')) {
    const storagePath = logoUrl.replace(/^logos\//, '');
    if (getStoragePublicUrl) return getStoragePublicUrl(storagePath);
    return DEFAULT_PORTAL_LOGO;
  }

  return logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
}

export function readCachedPortalLogo(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromWindow = window.__PORTAL_LOGO__;
    if (fromWindow) return fromWindow;
    const local = localStorage.getItem(LOGO_CACHE_KEY);
    if (local) return local;
    const session = sessionStorage.getItem(LOGO_CACHE_KEY);
    if (session) return session;
  } catch {
    // ignore
  }
  return null;
}

export function clearLogoCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOGO_CACHE_KEY);
    localStorage.removeItem('portal-logo-url-v2');
    localStorage.removeItem('portal-logo-url-v1');
    delete window.__PORTAL_LOGO__;
  } catch {
    // ignore
  }
}

export function broadcastLogoUpdated(url: string) {
  if (typeof window === 'undefined') return;
  try {
    window.__PORTAL_LOGO__ = url;
    localStorage.setItem(LOGO_CACHE_KEY, url);
    window.dispatchEvent(new CustomEvent('portal-logo-updated', { detail: { url } }));
  } catch {
    // ignore
  }
}

declare global {
  interface Window {
    __PORTAL_LOGO__?: string;
  }
}
