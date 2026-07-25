import { NextResponse } from 'next/server';
import { getCurrentLogo } from '@/lib/logo-utils-server';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';
import { logoMimeType } from '@/lib/pwa-icons';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function logoDataUri(requestUrl: string): Promise<string | null> {
  const logoUrl = (await getCurrentLogo()) || DEFAULT_PORTAL_LOGO;
  const absolute = logoUrl.startsWith('http') ? logoUrl : new URL(logoUrl, requestUrl).href;

  try {
    const response = await fetch(absolute, { cache: 'no-store' });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get('Content-Type') || logoMimeType(absolute);
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Distinct IIChE Chat icon: the chapter logo on a teal chat-app tile. */
export async function GET(request: Request) {
  const logo = await logoDataUri(request.url);
  const logoMarkup = logo
    ? `<image href="${logo}" x="80" y="80" width="352" height="352" preserveAspectRatio="xMidYMid meet"/>`
    : '<text x="256" y="305" text-anchor="middle" font-family="Arial, sans-serif" font-size="148" font-weight="700" fill="#0b6655">I</text>';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="112" fill="#00a884"/>
      <circle cx="256" cy="256" r="200" fill="#ffffff"/>
      ${logoMarkup}
      <g transform="translate(320 326)">
        <rect width="142" height="112" rx="46" fill="#0b6655"/>
        <path d="M32 100 17 134l43-22" fill="#0b6655"/>
        <circle cx="43" cy="56" r="9" fill="#ffffff"/>
        <circle cx="71" cy="56" r="9" fill="#ffffff"/>
        <circle cx="99" cy="56" r="9" fill="#ffffff"/>
      </g>
    </svg>
  `.trim();

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
