/** Matches forms UPDATE/DELETE RLS in migration 057. */
export function canManageForm(
  form: { created_by?: string | null },
  userId: string | null | undefined,
  profile?: {
    is_admin?: boolean | null;
    is_faculty?: boolean | null;
    executive_role?: string | null;
  } | null,
): boolean {
  if (!userId) return false;
  if (form.created_by && String(form.created_by) === String(userId)) return true;
  return !!(profile?.is_admin || profile?.is_faculty || profile?.executive_role);
}
