import { describe, expect, it } from 'vitest';
import {
  canEditOtherMemberProfiles,
  canSendEventParticipantEmail,
  isGraphicsCommitteeMember,
  isPrCommitteeMember,
} from '@/lib/member-profile-edit';

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

describe('event participant email access', () => {
  it('allows PR committee, faculty, and admins only', () => {
    expect(isPrCommitteeMember([{ committees: { name: 'PR Committee' } }])).toBe(true);
    expect(isPrCommitteeMember([{ committees: { name: 'Program Committee' } }])).toBe(false);
    expect(isPrCommitteeMember([{ committees: { name: 'Publicity Committee' } }])).toBe(false);
    expect(canSendEventParticipantEmail({ is_faculty: true, role: 'student' }, [])).toBe(true);
    expect(canSendEventParticipantEmail({ is_admin: true, role: 'student' }, [])).toBe(true);
    expect(canSendEventParticipantEmail({ role: 'super_admin' }, [])).toBe(true);
    expect(
      canSendEventParticipantEmail({ role: 'student' }, [{ committees: { name: 'PR Committee' } }]),
    ).toBe(true);
    expect(
      canSendEventParticipantEmail({ role: 'student' }, [{ committees: { name: 'Technical Committee' } }]),
    ).toBe(false);
  });
});
