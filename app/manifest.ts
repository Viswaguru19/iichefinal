import type { MetadataRoute } from 'next';
import { buildPwaManifestIcons } from '@/lib/pwa-icons';

export const dynamic = 'force-dynamic';

/** Portal app — separate from IIChE Chat (`/chat/manifest.webmanifest`). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'IIChE',
    short_name: 'IIChE',
    description: 'IIChE AVVU SC portal — events, forms, attendance, and committee workflows.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0a0a0a',
    theme_color: '#7DD3C0',
    categories: ['education', 'productivity'],
    icons: buildPwaManifestIcons(),
  } as MetadataRoute.Manifest;
}
