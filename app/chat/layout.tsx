import type { Metadata, Viewport } from 'next';
import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';
import PortalLogoProvider from '@/components/dashboard/PortalLogoProvider';
import ChatServiceWorkerRegistrar from '@/components/chat/ChatServiceWorkerRegistrar';
import { buildChatMetadataIcons } from '@/lib/pwa-icons';

export const metadata: Metadata = {
  title: 'IIChE Chat',
  description: 'IIChE AVVU SC messaging — direct and group chats.',
  applicationName: 'IIChE Chat',
  manifest: '/chat/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'IIChE Chat',
    statusBarStyle: 'black-translucent',
  },
  icons: buildChatMetadataIcons(),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#00a884',
  interactiveWidget: 'resizes-content',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLogoProvider>
      <ChatServiceWorkerRegistrar />
      <PortalPresenceProvider>{children}</PortalPresenceProvider>
    </PortalLogoProvider>
  );
}
