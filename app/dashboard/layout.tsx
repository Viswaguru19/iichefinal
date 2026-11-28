import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';
import PortalLogoProvider from '@/components/dashboard/PortalLogoProvider';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import DemoModeBanner from '@/components/DemoModeBanner';
import WinnerCelebration from '@/components/election/WinnerCelebration';
import IicheAiLauncher from '@/components/iiche-ai/IicheAiLauncher';

/**
 * Sync layout — no per-navigation server logo fetch (was a major delay with force-dynamic).
 * Logo resolves client-side via PortalLogoProvider + session cache.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLogoProvider>
      <ServiceWorkerRegistrar />
      <PortalPresenceProvider>
        <DemoModeBanner />
        {children}
        <WinnerCelebration />
        <IicheAiLauncher />
        <InstallAppPrompt />
      </PortalPresenceProvider>
    </PortalLogoProvider>
  );
}
