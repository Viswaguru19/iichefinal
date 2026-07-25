import { NextResponse } from 'next/server';
import { buildPwaManifestIcons } from '@/lib/pwa-icons';

export const dynamic = 'force-dynamic';

/**
 * IIChE Chat — separate installable PWA from the portal (IIChE).
 * Different id + start_url so phones can install both home-screen apps.
 */
export async function GET() {
  const body = {
    id: '/chat',
    name: 'IIChE Chat',
    short_name: 'IIChE Chat',
    description: 'WhatsApp-style messaging for IIChE AVVU SC — DMs, groups, files, and polls.',
    start_url: '/chat',
    scope: '/chat',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b141a',
    theme_color: '#00a884',
    categories: ['social', 'communication'],
    icons: buildPwaManifestIcons(),
    shortcuts: [
      {
        name: 'New chat',
        short_name: 'New chat',
        url: '/chat',
        icons: buildPwaManifestIcons()?.slice(0, 1),
      },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
