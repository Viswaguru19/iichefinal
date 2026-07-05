/** Whether a form can be filled without logging in (public share link). */
export function formAllowsPublicAccess(settings: Record<string, unknown> | null | undefined): boolean {
  const s = settings || {};
  const requireLogin = !!(s.require_login ?? s.requireLogin);
  const access = String(s.access_type ?? s.accessType ?? 'public').trim().toLowerCase();
  return !requireLogin && access !== 'internal';
}

export function publicFormUrl(origin: string, formId: string): string {
  return `${origin.replace(/\/$/, '')}/forms/${formId}`;
}
