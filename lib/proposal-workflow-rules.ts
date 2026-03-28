/**
 * Rules for event proposal approval (head → EC → faculty).
 * Config is stored in workflow_config.workflow_type = 'approval_thresholds'.
 */

export type ProposalHeadApprovalMode = 'single_head' | 'two_heads';

/** EC secretariat roles that count toward proposal EC approval */
export const EC_SECRETARY_TIER = ['secretary', 'associate_secretary'] as const;
export const EC_JOINT_TIER = ['joint_secretary', 'associate_joint_secretary'] as const;
export const EC_ANY_ONE_ROLES = [...EC_SECRETARY_TIER, ...EC_JOINT_TIER] as const;

export type ProposalEcApprovalMode = 'any_one_secretariat' | 'tiered_pair';

export type NormalizedProposalThresholds = {
  proposal_head_approval: ProposalHeadApprovalMode;
  proposal_ec_approval: ProposalEcApprovalMode;
};

export function normalizeProposalThresholds(raw: Record<string, unknown> | null | undefined): NormalizedProposalThresholds {
  const r = raw || {};
  let head = r.proposal_head_approval as string | undefined;
  if (head === 'head_and_cohead') head = 'two_heads';
  if (head !== 'single_head' && head !== 'two_heads') {
    if (Number(r.head_approvals_required) === 2) head = 'two_heads';
    else if (r.require_dual_head_approval === true) head = 'two_heads';
    else head = 'single_head';
  }

  let ec = r.proposal_ec_approval as ProposalEcApprovalMode | undefined;
  if (ec !== 'any_one_secretariat' && ec !== 'tiered_pair') {
    const legacy = r.ec_approval_mode as string | undefined;
    if (legacy === 'one_from_each_tier') ec = 'tiered_pair';
    else ec = 'any_one_secretariat';
  }

  return { proposal_head_approval: head as ProposalHeadApprovalMode, proposal_ec_approval: ec };
}

export function executiveRoleCountsForProposalEc(
  executiveRole: string | null | undefined,
  mode: ProposalEcApprovalMode,
): boolean {
  if (!executiveRole) return false;
  if (mode === 'any_one_secretariat') {
    return (EC_ANY_ONE_ROLES as readonly string[]).includes(executiveRole);
  }
  return (
    (EC_SECRETARY_TIER as readonly string[]).includes(executiveRole) ||
    (EC_JOINT_TIER as readonly string[]).includes(executiveRole)
  );
}

export type EcApprovalRow = {
  approved?: boolean | null;
  profiles?: { executive_role?: string | null } | null;
};

export function proposalEcSatisfied(mode: ProposalEcApprovalMode, approvals: EcApprovalRow[]): boolean {
  const list = approvals.filter((a) => a.approved === true);
  if (mode === 'any_one_secretariat') {
    return list.some((a) => (EC_ANY_ONE_ROLES as readonly string[]).includes(a.profiles?.executive_role || ''));
  }
  const hasSec = list.some((a) => (EC_SECRETARY_TIER as readonly string[]).includes(a.profiles?.executive_role || ''));
  const hasJoint = list.some((a) => (EC_JOINT_TIER as readonly string[]).includes(a.profiles?.executive_role || ''));
  return hasSec && hasJoint;
}

/** Progress for UI: satisfied slots / required slots */
export function proposalEcProgress(mode: ProposalEcApprovalMode, approvals: EcApprovalRow[]): { done: number; total: number } {
  const list = approvals.filter((a) => a.approved === true);
  if (mode === 'any_one_secretariat') {
    const ok = list.some((a) => (EC_ANY_ONE_ROLES as readonly string[]).includes(a.profiles?.executive_role || ''));
    return { done: ok ? 1 : 0, total: 1 };
  }
  const hasSec = list.some((a) => (EC_SECRETARY_TIER as readonly string[]).includes(a.profiles?.executive_role || ''));
  const hasJoint = list.some((a) => (EC_JOINT_TIER as readonly string[]).includes(a.profiles?.executive_role || ''));
  return { done: (hasSec ? 1 : 0) + (hasJoint ? 1 : 0), total: 2 };
}

export function describeProposalThresholds(c: NormalizedProposalThresholds): { head: string; ec: string } {
  return {
    head:
      c.proposal_head_approval === 'two_heads'
        ? 'Two different committee heads must approve before EC'
        : 'Any one committee head approval sends the proposal to EC',
    ec:
      c.proposal_ec_approval === 'tiered_pair'
        ? 'EC: one approver from Secretary / Associate Secretary and one from Joint / Associate Joint Secretary'
        : 'EC: any one approval from Secretary, Associate Secretary, Joint Secretary, or Associate Joint Secretary',
  };
}
