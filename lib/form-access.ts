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

export type ResponseViewerSettings = {
  response_viewers_all?: boolean | null;
  responseViewersAll?: boolean | null;
  response_viewer_ids?: string[] | null;
  responseViewerIds?: string[] | null;
};

export function isResponseViewersAll(settings?: ResponseViewerSettings | null): boolean {
  const s = settings || {};
  return s.response_viewers_all === true || s.responseViewersAll === true;
}

/** Admins, faculty, form creator, all members (if enabled), or listed response_viewer_ids. */
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
  if (isResponseViewersAll(settings)) return true;
  const ids = settings.response_viewer_ids || settings.responseViewerIds || [];
  if (!Array.isArray(ids)) return false;
  return ids.map(String).includes(String(userId));
}

export function getResponseViewerIds(settings?: ResponseViewerSettings | null): string[] {
  const ids = settings?.response_viewer_ids || settings?.responseViewerIds || [];
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(String).filter(Boolean))];
}

/** Form is accepting real (live) responses. `is_active` is the source of truth. */
export function isFormCollecting(form: {
  is_active?: boolean | null;
  settings?: { status?: string | null } | null;
} | null | undefined): boolean {
  if (!form) return false;
  // Prefer is_active — older rows sometimes kept status:'draft' after Start Collecting.
  return form.is_active === true;
}

/** Explicit test mode: link accepts TEST responses (cleared when Start Collecting). */
export function isFormTestMode(form: {
  settings?: {
    test_mode?: boolean | null;
    testMode?: boolean | null;
  } | null;
} | null | undefined): boolean {
  const s = form?.settings || {};
  return s.test_mode === true || s.testMode === true;
}

/**
 * Personal QR after submit:
 * - Event registration: always (compulsory)
 * - Normal form: only when settings toggle is on (default off)
 */
export function shouldShowPersonalQrAfterSubmit(
  settings: Record<string, unknown> | null | undefined,
  formType: string | undefined,
): boolean {
  if (formType === 'event_registration') return true;
  const s = settings || {};
  return s.show_attendance_qr_after_submit === true || s.showAttendanceQrAfterSubmit === true;
}
