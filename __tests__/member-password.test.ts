import { describe, expect, it } from 'vitest';
import { canManageMemberPasswords, generateTempPassword, recoveryConfirmUrl } from '@/lib/member-password';

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

describe('recoveryConfirmUrl', () => {
  it('builds a portal confirm link from the hashed token', () => {
    expect(
      recoveryConfirmUrl('https://portal.example', {
        hashed_token: 'abc+def',
        action_link: 'https://x.supabase.co/auth/v1/verify?token=other',
      }),
    ).toBe('https://portal.example/auth/confirm?token_hash=abc%2Bdef&type=recovery');
  });
});
