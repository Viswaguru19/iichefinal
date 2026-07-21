import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';
import PortalLogoProvider from '@/components/dashboard/PortalLogoProvider';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import { getCurrentLogo } from '@/lib/logo-utils-server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = await getCurrentLogo();

  return (
    <PortalLogoProvider logoUrl={logoUrl}>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PORTAL_LOGO__=${JSON.stringify(logoUrl)};`,
        }}
      />
      <ServiceWorkerRegistrar />
      <PortalPresenceProvider>{children}</PortalPresenceProvider>
    </PortalLogoProvider>
  );
}
