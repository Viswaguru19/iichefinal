import { isPortalAdmin } from '@/lib/permissions';

type CommitteeName = { name?: string | null };
type CommitteeRef = CommitteeName | CommitteeName[] | null;

function committeeDisplayName(value: CommitteeRef | undefined, fallback?: string | null): string {
  if (Array.isArray(value)) return String(value[0]?.name || fallback || '');
  return String(value?.name || fallback || '');
}

export function isGraphicsCommitteeMember(
  memberships:
    | { committees?: CommitteeRef; name?: string | null }[]
    | null
    | undefined,
): boolean {
  return (memberships || []).some((m) => {
    const name = committeeDisplayName(m.committees, m.name).toLowerCase();
    return name.includes('graphics');
  });
}

export function canEditOtherMemberProfiles(
  profile: { is_admin?: boolean | null; role?: string | null } | null | undefined,
  memberships:
    | { committees?: CommitteeRef; name?: string | null }[]
    | null
    | undefined,
): boolean {
  return isPortalAdmin(profile) || isGraphicsCommitteeMember(memberships);
}

export function memberAvatarSrc(
  supabase: { storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } } },
  avatarUrl?: string | null,
  profilePhoto?: string | null,
): string | null {
  const raw = String(profilePhoto || avatarUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  return supabase.storage.from('avatars').getPublicUrl(raw).data.publicUrl || null;
}
