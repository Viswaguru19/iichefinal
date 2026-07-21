/** Default IIChE logo used when DB/storage logo is unavailable. */
export const DEFAULT_PORTAL_LOGO = '/icons/iiche-app-icon.svg';

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

  if (logoUrl.startsWith('logos/')) {
    const storagePath = logoUrl.replace(/^logos\//, '');
    if (getStoragePublicUrl) return getStoragePublicUrl(storagePath);
    return DEFAULT_PORTAL_LOGO;
  }

  if (logoUrl === 'logo.svg') return '/logo.svg';

  return logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
}

export const LOGO_CACHE_KEY = 'portal-logo-url-v2';
