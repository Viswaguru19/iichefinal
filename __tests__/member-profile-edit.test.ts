import { describe, expect, it } from 'vitest';
import { canEditOtherMemberProfiles, isGraphicsCommitteeMember } from '@/lib/member-profile-edit';

describe('member profile edit access', () => {
  it('allows graphics committee members', () => {
    expect(isGraphicsCommitteeMember([{ committees: { name: 'Graphics Committee' } }])).toBe(true);
    expect(
      canEditOtherMemberProfiles({ is_admin: false, role: 'student' }, [{ committees: { name: 'Graphics' } }]),
    ).toBe(true);
  });

  it('allows portal admins and rejects other members', () => {
    expect(canEditOtherMemberProfiles({ is_admin: true, role: 'student' }, [])).toBe(true);
    expect(canEditOtherMemberProfiles({ role: 'super_admin' }, [])).toBe(true);
    expect(canEditOtherMemberProfiles({ role: 'student' }, [{ committees: { name: 'Program Committee' } }])).toBe(false);
  });
});
