import { describe, expect, it } from 'vitest';
import { canManageStatementOfAccounts } from '@/lib/permissions';
import { sortStatementRows, withSequentialLedger } from '@/lib/statement-of-accounts';

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

describe('statement of accounts serial numbers', () => {
  it('sorts by date then lists Sr 1, 2, 3 with running balance', () => {
    const rows = withSequentialLedger([
      { id: 'c', date: '2026-03-10', created_at: '2026-03-10T10:00:00Z', sr_no: 9, debit: 100, credit: 0 },
      { id: 'a', date: '2026-01-05', created_at: '2026-01-05T10:00:00Z', sr_no: 4, debit: 0, credit: 500 },
      { id: 'b', date: '2026-02-01', created_at: '2026-02-01T10:00:00Z', sr_no: 1, debit: 50, credit: 0 },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.sr_no)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.balance)).toEqual([500, 450, 350]);
  });

  it('keeps same-day rows in created order', () => {
    const rows = sortStatementRows([
      { id: 'later', date: '2026-09-25', created_at: '2026-09-25T12:00:00Z', sr_no: 1 },
      { id: 'earlier', date: '2026-09-25', created_at: '2026-09-25T08:00:00Z', sr_no: 8 },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['earlier', 'later']);
  });
});
