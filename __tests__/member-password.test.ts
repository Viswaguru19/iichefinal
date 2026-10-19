import { describe, expect, it } from 'vitest';
import { canManageMemberPasswords, generateTempPassword } from '@/lib/member-password';

describe('generateTempPassword', () => {
  it('returns a copyable temp password', () => {
    const password = generateTempPassword();
    expect(password.startsWith('Tmp-')).toBe(true);
    expect(password.length).toBeGreaterThan(10);
    expect(generateTempPassword()).not.toBe(password);
  });
});

describe('canManageMemberPasswords', () => {
  it('allows admin and faculty only', () => {
    expect(canManageMemberPasswords({ is_admin: true })).toBe(true);
    expect(canManageMemberPasswords({ is_faculty: true })).toBe(true);
    expect(canManageMemberPasswords({ role: 'super_admin' })).toBe(true);
    expect(canManageMemberPasswords({ role: 'committee_member' })).toBe(false);
  });
});
