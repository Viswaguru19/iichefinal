import { isCoHeadPosition, isHeadPosition } from '@/lib/committee-positions';

export const ELECTION_CATEGORIES = [
  {
    id: 'secretary',
    title: 'Secretary',
    firstRole: 'Secretary',
    secondRole: 'Associate Secretary',
  },
  {
    id: 'joint_secretary',
    title: 'Joint Secretary',
    firstRole: 'Joint Secretary',
    secondRole: 'Associate Joint Secretary',
  },
  {
    id: 'treasurer',
    title: 'Treasurer',
    firstRole: 'Treasurer',
    secondRole: 'Associate Treasurer',
  },
] as const;

export type ElectionCategoryId = (typeof ELECTION_CATEGORIES)[number]['id'];
export type ElectionStatus = 'nominations' | 'voting' | 'closed';

export type ElectionProfile = {
  role?: string | null;
  is_admin?: boolean | null;
  is_faculty?: boolean | null;
};

export type ElectionCommitteeRow = { name?: string | null; position?: string | null };

export function isSocialEnvironmentalCommittee(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return n.includes('social') && n.includes('environment');
}

export function canManageEcElection(
  profile: ElectionProfile | null | undefined,
  committees: ElectionCommitteeRow[],
): boolean {
  if (!profile) return false;
  if (profile.is_admin === true || profile.is_faculty === true) return true;
  const role = String(profile.role || '');
  if (role === 'admin' || role === 'faculty_advisor' || role === 'super_admin') return true;
  return committees.some((c) => isSocialEnvironmentalCommittee(c.name));
}

export function canViewLiveElectionTally(profile: ElectionProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_admin === true) return true;
  return String(profile.role || '') === 'super_admin' || String(profile.role || '') === 'admin';
}

export function canRemoveEcNomination(profile: ElectionProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_faculty === true || profile.is_admin === true) return true;
  const role = String(profile.role || '');
  return role === 'faculty_advisor' || role === 'admin' || role === 'super_admin';
}

export const ELECTION_BALLOT_SIZE = 2;

export function ballotContestants<T extends { createdAt?: string; created_at?: string; on_ballot?: boolean }>(
  rows: T[],
  limit = ELECTION_BALLOT_SIZE,
): T[] {
  if (rows.some((row) => typeof row.on_ballot === 'boolean')) {
    return rows.filter((row) => row.on_ballot);
  }
  return [...rows]
    .sort((a, b) => String(a.created_at || a.createdAt || '').localeCompare(String(b.created_at || b.createdAt || '')))
    .slice(0, limit);
}

export function resolveElectionAvatarUrl(
  raw: string | null | undefined,
  publicUrlForPath: (path: string) => string,
): string | null {
  if (!raw || !String(raw).trim()) return null;
  const value = String(raw).trim();
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return publicUrlForPath(value);
}

export function formatElectionCountdown(endsAt: string | null | undefined, nowMs: number): string | null {
  if (!endsAt) return null;
  const remaining = new Date(endsAt).getTime() - nowMs;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return 'Ended';
  const totalSec = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function minutesToDurationParts(minutes: number | null | undefined): { hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(minutes || 0));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export function canContestEcElection(
  committees: ElectionCommitteeRow[],
  category: ElectionCategoryId,
): boolean {
  if (category === 'secretary') return committees.some((c) => isHeadPosition(c.position));
  return committees.some((c) => isCoHeadPosition(c.position));
}

export function canVoteEcElection(committees: ElectionCommitteeRow[]): boolean {
  return committees.some((c) => isHeadPosition(c.position) || isCoHeadPosition(c.position));
}

export type RankedContestant = {
  id: string;
  name: string;
  votes: number;
  createdAt: string;
};

export function rankContestants(rows: RankedContestant[]): RankedContestant[] {
  return [...rows].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function winnersForCategory(ranked: RankedContestant[]): {
  first: RankedContestant | null;
  second: RankedContestant | null;
} {
  return {
    first: ranked[0] || null,
    second: ranked[1] || null,
  };
}

export function formatExecutiveRole(role: string | null | undefined): string {
  if (!role) return '';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function electionCardCopy(status: ElectionStatus | null, resultsVisible: boolean): {
  title: string;
  description: string;
} {
  if (resultsVisible) return { title: 'EC Election', description: 'Results' };
  if (status === 'voting') return { title: 'EC Election', description: 'Vote' };
  if (status === 'closed') return { title: 'EC Election', description: 'Ended' };
  if (status === 'nominations') return { title: 'EC Election', description: 'Contest' };
  return { title: 'EC Election', description: 'Open' };
}
