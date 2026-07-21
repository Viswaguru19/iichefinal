/** Default IIChE logo used when DB/storage logo is unavailable. */
export const DEFAULT_PORTAL_LOGO = '/icons/iiche-app-icon.svg';

export const LOGO_CACHE_KEY = 'portal-logo-url-v3';

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

  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl;
  }

  // Stored as "logos/filename.png" — file lives in the logos storage bucket
  if (logoUrl.startsWith('logos/')) {
    const storagePath = logoUrl.replace(/^logos\//, '');
    if (getStoragePublicUrl) return getStoragePublicUrl(storagePath);
    return DEFAULT_PORTAL_LOGO;
  }

  if (logoUrl === 'logo.svg') return '/logo.svg';

  return logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
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
