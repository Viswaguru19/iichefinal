import type { Metadata, Viewport } from 'next';
import PortalPresenceProvider from '@/components/dashboard/PortalPresenceProvider';
import PortalLogoProvider from '@/components/dashboard/PortalLogoProvider';
import ChatServiceWorkerRegistrar from '@/components/chat/ChatServiceWorkerRegistrar';
import { getCurrentLogo } from '@/lib/logo-utils-server';
import { buildChatMetadataIcons } from '@/lib/pwa-icons';

export const dynamic = 'force-dynamic';

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
};

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = await getCurrentLogo();

  return (
    <PortalLogoProvider logoUrl={logoUrl}>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PORTAL_LOGO__=${JSON.stringify(logoUrl)};`,
        }}
      />
      <ChatServiceWorkerRegistrar />
      <PortalPresenceProvider>{children}</PortalPresenceProvider>
    </PortalLogoProvider>
  );
}
