/** Labels for admin dashboards — uses workflow `status`, not legacy `approved`. */
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_head_approval: 'Pending head approval',
  pending_second_head_approval: 'Second head approval',
  review_by_cohead: 'Co-head review',
  pending_ec_approval: 'Pending EC approval',
  rejected_by_head: 'Rejected (head)',
  pending_faculty_approval: 'Pending faculty approval',
  faculty_approved: 'Faculty approved',
  active: 'Active',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function adminEventWorkflowLabel(event: { status?: string | null; approved?: boolean | null }) {
  const s = event.status?.trim();
  if (s) {
    return STATUS_LABELS[s] || s.replace(/_/g, ' ');
  }
  return event.approved ? 'Approved (legacy)' : 'Not approved (legacy)';
}

export function adminEventStatusBadgeClass(event: { status?: string | null; approved?: boolean | null }) {
  const s = event.status?.trim();
  if (s === 'active' || s === 'completed' || s === 'faculty_approved') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (s === 'cancelled' || s === 'rejected_by_head') {
    return 'bg-red-100 text-red-800';
  }
  if (!s && event.approved) {
    return 'bg-green-100 text-green-800';
  }
  return 'bg-amber-100 text-amber-800';
}
