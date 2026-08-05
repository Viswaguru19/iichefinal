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

type ResponseViewerSettings = {
  response_viewer_ids?: string[] | null;
  responseViewerIds?: string[] | null;
};

/** Admins, faculty, form creator, or members listed in settings.response_viewer_ids. */
export function canViewFormResponses(
  form: {
    created_by?: string | null;
    settings?: ResponseViewerSettings | null;
  } | null | undefined,
  userId: string | null | undefined,
  profile?: {
    is_admin?: boolean | null;
    is_faculty?: boolean | null;
  } | null,
): boolean {
  if (!userId) return false;
  if (profile?.is_admin || profile?.is_faculty) return true;
  if (form?.created_by && form.created_by === userId) return true;
  const settings = form?.settings || {};
  const ids = settings.response_viewer_ids || settings.responseViewerIds || [];
  if (!Array.isArray(ids)) return false;
  return ids.map(String).includes(String(userId));
}

export function getResponseViewerIds(settings?: ResponseViewerSettings | null): string[] {
  const ids = settings?.response_viewer_ids || settings?.responseViewerIds || [];
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(String).filter(Boolean))];
}
