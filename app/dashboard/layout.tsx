import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';
import PortalLogoProvider from '@/components/dashboard/PortalLogoProvider';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import { getCurrentLogo } from '@/lib/logo-utils-server';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = await getCurrentLogo();

  return (
    <PortalLogoProvider logoUrl={logoUrl}>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PORTAL_LOGO__=${JSON.stringify(logoUrl)};try{localStorage.removeItem('portal-logo-url-v1');localStorage.removeItem('portal-logo-url-v2');}catch(e){}`,
        }}
      />
      <ServiceWorkerRegistrar />
      <PortalPresenceProvider>{children}</PortalPresenceProvider>
    </PortalLogoProvider>
  );
}
