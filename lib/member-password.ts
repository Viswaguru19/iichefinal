export function generateTempPassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const size = Math.max(8, Math.min(24, length));
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let body = '';
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  return `Tmp-${body}`;
}

export function appOriginFromRequest(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  if (!host) return 'http://localhost:3000';
  return `${proto}://${host}`;
}

export function recoveryConfirmUrl(
  origin: string,
  properties: { hashed_token?: string | null; action_link?: string | null } | null | undefined,
): string | null {
  const base = origin.replace(/\/$/, '');
  let token = String(properties?.hashed_token || '').trim();
  if (!token && properties?.action_link) {
    try {
      token = new URL(properties.action_link).searchParams.get('token') || '';
    } catch {
      token = '';
    }
  }
  if (!token) return null;
  return `${base}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery`;
}

export function canManageMemberPasswords(profile: {
  is_admin?: boolean | null;
  is_faculty?: boolean | null;
  role?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_admin === true || profile.is_faculty === true) return true;
  const role = String(profile.role || '');
  return role === 'super_admin' || role === 'secretary' || role === 'faculty_advisor';
}
