/**
 * Events that may have a registration form attached and accept new sign-ups.
 * Keep in sync with dashboard form builder event picker.
 */
export const EVENT_REGISTRATION_ELIGIBLE_STATUSES = ['active', 'in_progress', 'faculty_approved'] as const;

export function isEventOpenForRegistration(status: string | null | undefined): boolean {
  return !!status && (EVENT_REGISTRATION_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}
