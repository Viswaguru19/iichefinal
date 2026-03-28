import type { ExecutiveRole, UserRole } from '@/types/database';

/** Synthetic executive committee id used when head/co-head are added to the EC roster */
export const EXECUTIVE_COMMITTEE_SYNTHETIC_ID = '00000000-0000-0000-0000-000000000001';

export const EXECUTIVE_OFFICE_OPTIONS: { value: ExecutiveRole; label: string }[] = [
  { value: 'secretary', label: 'Secretary' },
  { value: 'associate_secretary', label: 'Associate Secretary' },
  { value: 'joint_secretary', label: 'Joint Secretary' },
  { value: 'associate_joint_secretary', label: 'Associate Joint Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'associate_treasurer', label: 'Associate Treasurer' },
];

export function committeePositionToUserRole(position: 'head' | 'co_head' | 'member'): UserRole {
  if (position === 'head') return 'committee_head';
  if (position === 'co_head') return 'committee_cohead';
  return 'committee_member';
}

export function parseExecutiveOffice(value: string): ExecutiveRole | null {
  if (!value) return null;
  return value as ExecutiveRole;
}
