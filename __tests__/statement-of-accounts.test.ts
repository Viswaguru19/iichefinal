import { describe, expect, it } from 'vitest';
import { canManageStatementOfAccounts } from '@/lib/permissions';

describe('statement of accounts manage rights', () => {
  it('lets portal admins edit', () => {
    expect(canManageStatementOfAccounts({ is_admin: true, role: 'student' })).toBe(true);
    expect(canManageStatementOfAccounts({ is_admin: false, role: 'super_admin' })).toBe(true);
    expect(canManageStatementOfAccounts({ is_admin: false, role: 'secretary' })).toBe(true);
  });

  it('keeps faculty and treasurers able to edit', () => {
    expect(canManageStatementOfAccounts({ is_faculty: true, role: 'student' })).toBe(true);
    expect(canManageStatementOfAccounts({ executive_role: 'treasurer' })).toBe(true);
    expect(canManageStatementOfAccounts({ executive_role: 'associate_treasurer' })).toBe(true);
  });

  it('does not let regular members edit', () => {
    expect(canManageStatementOfAccounts({ role: 'student', executive_role: 'joint_secretary' })).toBe(false);
    expect(canManageStatementOfAccounts({ role: 'committee_head' })).toBe(false);
    expect(canManageStatementOfAccounts(null)).toBe(false);
  });
});
