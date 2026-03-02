type UserRole = string;

export function hasAdminAccess(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head'].includes(role);
}

export function canManageCommittee(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head', 'committee_head', 'committee_cohead'].includes(role);
}

export function canApproveTeams(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head', 'committee_head'].includes(role);
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin';
}

export function isExecutiveMember(role: UserRole): boolean {
  return ['super_admin', 'secretary', 'program_head', 'committee_head', 'committee_cohead'].includes(role);
}
