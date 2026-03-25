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
