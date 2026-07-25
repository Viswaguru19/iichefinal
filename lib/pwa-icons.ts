import type { MetadataRoute } from 'next';

/** Infer MIME type for manifest / metadata icons. */
export function logoMimeType(logoUrl: string): string {
  const lower = logoUrl.split('?')[0].toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

/** Stable app-icon URL — resolves to the active admin logo at request time. */
export const PWA_ICON_URL = '/api/pwa/icon';
export const CHAT_PWA_ICON_URL = '/api/pwa/chat-icon';

export function buildPwaManifestIcons(): MetadataRoute.Manifest['icons'] {
  return [
    {
      src: PWA_ICON_URL,
      sizes: 'any',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: PWA_ICON_URL,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: PWA_ICON_URL,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: PWA_ICON_URL,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
  ];
}

export function buildMetadataIcons() {
  return {
    icon: [{ url: PWA_ICON_URL, type: 'image/png' }],
    apple: [{ url: PWA_ICON_URL, sizes: '180x180', type: 'image/png' }],
  };
}

export function buildChatPwaManifestIcons(): MetadataRoute.Manifest['icons'] {
  return [
    {
      src: CHAT_PWA_ICON_URL,
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: CHAT_PWA_ICON_URL,
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'maskable',
    },
  ];
}

export function buildChatMetadataIcons() {
  return {
    icon: [{ url: CHAT_PWA_ICON_URL, type: 'image/svg+xml' }],
    apple: [{ url: CHAT_PWA_ICON_URL, type: 'image/svg+xml' }],
  };
}
