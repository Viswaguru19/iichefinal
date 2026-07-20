import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';
import InstallAppPrompt from '@/components/InstallAppPrompt';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalPresenceProvider>
      {children}
      <InstallAppPrompt />
    </PortalPresenceProvider>
  );
}
