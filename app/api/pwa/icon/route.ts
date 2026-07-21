import { NextResponse } from 'next/server';
import { getCurrentLogo } from '@/lib/logo-utils-server';
import { DEFAULT_PORTAL_LOGO } from '@/lib/logo-utils';
import { logoMimeType } from '@/lib/pwa-icons';

export const dynamic = 'force-dynamic';

async function fetchIconBytes(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

/**
 * App install / home-screen icon — serves the active admin-uploaded logo bytes.
 * Manifest and layout metadata point here so install uses the DB logo, not a hardcoded file.
 */
export async function GET(request: Request) {
  const logoUrl = await getCurrentLogo();
  const target = logoUrl || DEFAULT_PORTAL_LOGO;
  const absolute = target.startsWith('http') ? target : new URL(target, request.url).href;

  let res = await fetchIconBytes(absolute);

  if (!res) {
    const fallbackUrl = new URL(DEFAULT_PORTAL_LOGO, request.url).href;
    res = await fetchIconBytes(fallbackUrl);
  }

  if (!res) {
    return NextResponse.json({ error: 'Icon unavailable' }, { status: 404 });
  }

  const contentType = res.headers.get('Content-Type') || logoMimeType(absolute);

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
