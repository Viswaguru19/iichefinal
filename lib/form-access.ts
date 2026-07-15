/** Any authenticated portal user can manage (edit/delete) any form. */
export function canManageForm(
  _form: { created_by?: string | null },
  userId: string | null | undefined,
  _profile?: {
    is_admin?: boolean | null;
    is_faculty?: boolean | null;
    executive_role?: string | null;
  } | null,
): boolean {
  return !!userId;
}
