import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IIChE AVVU SC Portal",
  description: "Official portal for IIChE AVVU SC - Indian Institute of Chemical Engineers",
  applicationName: "IIChE AVVU",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IIChE AVVU",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/logo.svg', type: 'image/svg+xml', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7DD3C0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
