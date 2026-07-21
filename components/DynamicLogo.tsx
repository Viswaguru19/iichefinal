'use client';

import { useEffect, useState } from 'react';
import { usePortalLogo } from '@/components/dashboard/PortalLogoProvider';
import { getCurrentLogoClient } from '@/lib/logo-utils-client';
import { DEFAULT_PORTAL_LOGO, LOGO_CACHE_KEY } from '@/lib/logo-utils';

declare global {
  interface Window {
    __PORTAL_LOGO__?: string;
  }
}

function readCachedLogo(): string | null {
  try {
    const cached = localStorage.getItem(LOGO_CACHE_KEY);
    if (cached) return cached;
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.__PORTAL_LOGO__) {
    return window.__PORTAL_LOGO__;
  }
  return null;
}

function cacheLogo(url: string) {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, url);
  } catch {
    // ignore
  }
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
  const [logoUrl, setLogoUrl] = useState(() => readCachedLogo() || serverLogo || DEFAULT_PORTAL_LOGO);

  useEffect(() => {
    const initial = readCachedLogo() || serverLogo || DEFAULT_PORTAL_LOGO;
    setLogoUrl(initial);

    void getCurrentLogoClient().then((url) => {
      if (!url) return;
      setLogoUrl((prev) => {
        if (url === prev) return prev;
        cacheLogo(url);
        return url;
      });
    });
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
      onError={(e) => {
        if (e.currentTarget.src.includes(DEFAULT_PORTAL_LOGO)) return;
        e.currentTarget.src = DEFAULT_PORTAL_LOGO;
        cacheLogo(DEFAULT_PORTAL_LOGO);
      }}
    />
  );
}
