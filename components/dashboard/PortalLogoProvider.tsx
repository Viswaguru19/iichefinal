'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';
import { resolveActiveLogoUrl } from '@/lib/logo-resolve';

const PortalLogoContext = createContext<string>(DEFAULT_PORTAL_LOGO);
const LOGO_CACHE_KEY = 'portal-logo-url-v3';

export function usePortalLogo() {
  return useContext(PortalLogoContext);
}

/**
 * Loads logo on the client (cached) so the dashboard layout stays sync and does not
 * block every navigation on a server Supabase round-trip.
 */
export default function PortalLogoProvider({
  logoUrl,
  children,
}: {
  logoUrl?: string;
  children: React.ReactNode;
}) {
  const [url, setUrl] = useState(logoUrl || DEFAULT_PORTAL_LOGO);

  useEffect(() => {
    let cancelled = false;
    try {
      const cached = sessionStorage.getItem(LOGO_CACHE_KEY);
      if (cached) setUrl(cached);
    } catch {
      /* ignore */
    }

    const load = async () => {
      try {
        const supabase = createClient();
        const next = await resolveActiveLogoUrl(supabase);
        if (cancelled || !next) return;
        setUrl(next);
        try {
          sessionStorage.setItem(LOGO_CACHE_KEY, next);
        } catch {
          /* ignore */
        }
      } catch {
        /* keep default / cached */
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => void load(), { timeout: 2000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const t = setTimeout(() => void load(), 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return <PortalLogoContext.Provider value={url}>{children}</PortalLogoContext.Provider>;
}
