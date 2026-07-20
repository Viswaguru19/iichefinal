import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IIChE AVVU SC Portal',
    short_name: 'IIChE AVVU',
    description: 'Official portal for IIChE AVVU SC — events, forms, attendance, and committee workflows.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0a0a0a',
    theme_color: '#7DD3C0',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/logo.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
