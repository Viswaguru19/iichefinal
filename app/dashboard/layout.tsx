import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PortalPresenceProvider>{children}</PortalPresenceProvider>;
}
