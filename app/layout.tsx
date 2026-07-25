import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { buildMetadataIcons } from '@/lib/pwa-icons';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'IIChE',
    description: 'Official portal for IIChE AVVU SC - Indian Institute of Chemical Engineers',
    applicationName: 'IIChE',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: 'IIChE',
      statusBarStyle: 'black-translucent',
    },
    formatDetection: {
      telephone: false,
    },
    icons: buildMetadataIcons(),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#7DD3C0' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} portal-app-body`}>
        <ServiceWorkerRegistrar />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = localStorage.getItem('portal-theme');
                  var theme = saved === 'light-gradient' ? 'light' : 'dark';
                  document.documentElement.setAttribute('data-portal-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-portal-theme', 'dark');
                }
              })();
            `,
          }}
        />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
