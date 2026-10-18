'use client';

import { useEffect, useState } from 'react';
import { usePortalLogo } from '@/components/dashboard/PortalLogoProvider';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';

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
  const [logoUrl, setLogoUrl] = useState(serverLogo || DEFAULT_PORTAL_LOGO);

  useEffect(() => {
    if (serverLogo) setLogoUrl(serverLogo);

    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url) setLogoUrl(detail.url);
    };
    window.addEventListener('portal-logo-updated', onUpdated);
    return () => window.removeEventListener('portal-logo-updated', onUpdated);
  }, [serverLogo]);

  return (
    <img
      src={logoUrl || DEFAULT_PORTAL_LOGO}
      alt={alt}
      width={width}
      height={height}
      className={`object-contain ${className}`}
      decoding="async"
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src.includes(DEFAULT_PORTAL_LOGO)) return;
        img.src = DEFAULT_PORTAL_LOGO;
        setLogoUrl(DEFAULT_PORTAL_LOGO);
      }}
    />
  );
}
