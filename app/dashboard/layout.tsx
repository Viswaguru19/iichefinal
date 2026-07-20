import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import PushNotificationManager from '@/components/PushNotificationManager';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalPresenceProvider>
      <PushNotificationManager />
      {children}
      <InstallAppPrompt />
    </PortalPresenceProvider>
  );
}
