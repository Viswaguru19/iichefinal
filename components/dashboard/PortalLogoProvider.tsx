'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PORTAL_LOGO, LOGO_CACHE_KEY } from '@/lib/logo-utils';
import { resolveActiveLogoUrl } from '@/lib/logo-resolve';

const PortalLogoContext = createContext<string>(DEFAULT_PORTAL_LOGO);

export function usePortalLogo() {
  return useContext(PortalLogoContext);
}

/**
 * First paint uses the bundled /public/logo.png. A later fetch only swaps
 * if an admin has uploaded a different logo.
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

    const load = async () => {
      try {
        const supabase = createClient();
        const next = await resolveActiveLogoUrl(supabase);
        if (cancelled || !next || next === DEFAULT_PORTAL_LOGO) return;
        setUrl(next);
        try {
          sessionStorage.setItem(LOGO_CACHE_KEY, next);
          localStorage.setItem(LOGO_CACHE_KEY, next);
        } catch {
          /* ignore */
        }
      } catch {
        // Keep the bundled default.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return <PortalLogoContext.Provider value={url}>{children}</PortalLogoContext.Provider>;
}
