/** Client-side mirror of hiring toggle rules (DB enforces via RLS + RPCs). */

export type HiringProfile = {
  role?: string | null;
  is_admin?: boolean | null;
  is_faculty?: boolean | null;
  executive_role?: string | null;
};

export type CommitteeNameRow = { name?: string | null };

export function isSocialEnvironmentalOrHrCommittee(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  if (n.includes('social') && n.includes('environment')) return true;
  if (n.includes('hr committee')) return true;
  return false;
}

export function canManageHiringToggle(
  profile: HiringProfile | null | undefined,
  userCommittees: CommitteeNameRow[],
): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  if (profile.is_faculty) return true;
  if (profile.executive_role) return true;
  const r = profile.role || '';
  if (r === 'admin' || r === 'faculty_advisor' || r === 'super_admin') return true;
  return userCommittees.some((c) => isSocialEnvironmentalOrHrCommittee(c.name));
}

export function canReviewHiringApplications(positions: string[]): boolean {
  return positions.some((p) => p === 'head' || p === 'co_head');
}
