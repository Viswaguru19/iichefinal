type UserRole = string;

export function hasAdminAccess(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head', 'faculty_advisor'].includes(role);
}

export function canManageCommittee(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head', 'faculty_advisor', 'committee_head', 'committee_cohead'].includes(role);
}

export function canApproveTeams(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head', 'faculty_advisor', 'committee_head'].includes(role);
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin';
}

export function isFacultyAdvisor(role: UserRole): boolean {
  return role === 'faculty_advisor';
}

export function isExecutiveMember(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head', 'faculty_advisor', 'committee_head', 'committee_cohead'].includes(role);
}

/** Portal admin: DB flag or super_admin / secretary role (matches dashboard & admin pages). */
export function isPortalAdmin(profile: {
  is_admin?: boolean | null;
  role?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_admin === true) return true;
  const role = String(profile.role || '');
  return role === 'super_admin' || role === 'secretary';
}

/** Add / edit / delete statement-of-accounts rows and attach bills. */
export function canManageStatementOfAccounts(profile: {
  is_admin?: boolean | null;
  is_faculty?: boolean | null;
  role?: string | null;
  executive_role?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_faculty === true) return true;
  if (isPortalAdmin(profile)) return true;
  const exec = String(profile.executive_role || '').trim().toLowerCase();
  return exec === 'treasurer' || exec === 'associate_treasurer';
}
