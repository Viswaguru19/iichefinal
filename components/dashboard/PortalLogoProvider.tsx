'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';

const PortalLogoContext = createContext<string>(DEFAULT_PORTAL_LOGO);

export function usePortalLogo() {
  return useContext(PortalLogoContext);
}

export default function PortalLogoProvider({
  logoUrl,
  children,
}: {
  logoUrl: string;
  children: React.ReactNode;
}) {
  return <PortalLogoContext.Provider value={logoUrl}>{children}</PortalLogoContext.Provider>;
}
