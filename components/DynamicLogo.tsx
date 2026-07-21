'use client';

import { useEffect, useState } from 'react';
import { usePortalLogo } from '@/components/dashboard/PortalLogoProvider';
import { getCurrentLogoClient } from '@/lib/logo-utils-client';
import { broadcastLogoUpdated, DEFAULT_PORTAL_LOGO, LOGO_CACHE_KEY } from '@/lib/logo-utils';

function isFallbackLogo(url: string) {
  return url.includes('/icons/iiche-app-icon') || url.endsWith('/logo.svg');
}

interface DynamicLogoProps {
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

export default function DynamicLogo({
  width = 40,
  height = 40,
  className = '',
  alt = 'IIChE AVVU SC Logo',
}: DynamicLogoProps) {
  const serverLogo = usePortalLogo();
  const [logoUrl, setLogoUrl] = useState(() => {
    if (serverLogo && !isFallbackLogo(serverLogo)) return serverLogo;
    if (typeof window !== 'undefined' && window.__PORTAL_LOGO__ && !isFallbackLogo(window.__PORTAL_LOGO__)) {
      return window.__PORTAL_LOGO__;
    }
    return serverLogo || DEFAULT_PORTAL_LOGO;
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const url = await getCurrentLogoClient();
      if (cancelled) return;
      setLogoUrl(url);
      if (!isFallbackLogo(url)) {
        broadcastLogoUpdated(url);
      }
    }

    if (serverLogo && !isFallbackLogo(serverLogo)) {
      setLogoUrl(serverLogo);
    }

    void refresh();

    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url) setLogoUrl(detail.url);
    };
    window.addEventListener('portal-logo-updated', onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('portal-logo-updated', onUpdated);
    };
  }, [serverLogo]);

  return (
    <img
      src={logoUrl}
      alt={alt}
      width={width}
      height={height}
      className={`object-contain ${className}`}
      decoding="async"
      fetchPriority="high"
      onError={() => {
        void (async () => {
          // Stale cache may point at a deleted file — refetch from DB once
          try {
            localStorage.removeItem(LOGO_CACHE_KEY);
          } catch {
            // ignore
          }
          const fresh = await getCurrentLogoClient();
          setLogoUrl((prev) => (fresh !== prev ? fresh : DEFAULT_PORTAL_LOGO));
        })();
      }}
    />
  );
}
