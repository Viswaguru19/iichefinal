export type EventProgressTask = {
  status?: string | null;
  completed_at?: string | null;
  progress?: number | null;
};

export type EventProgressSource = {
  status?: string | null;
  head_approved_by?: string | null;
};

/** Tasks that count toward overall event progress (approved / in flight). */
export function eventProgressTasks<T extends EventProgressTask>(tasks: T[] = []): T[] {
  return tasks.filter(
    (t) => t.status !== 'pending_ec_approval' && t.status !== 'rejected',
  );
}

/**
 * Overall event progress: 30% Head/EC/Faculty approvals + 70% averaged task %.
 * Shared by dashboard cards and event detail so the numbers stay in sync.
 */
export function computeEventOverallProgress(
  event: EventProgressSource,
  tasks: EventProgressTask[] = [],
): { overall: number; approval: number; taskShare: number; completed: number; total: number } {
  const approvedTasks = eventProgressTasks(tasks);
  const completed = approvedTasks.filter(
    (t) => t.status === 'completed' || !!t.completed_at,
  ).length;
  const total = approvedTasks.length;

  const headApproved = !!event.head_approved_by;
  const ecApproved =
    event.status !== 'pending_head_approval' &&
    event.status !== 'pending_second_head_approval' &&
    event.status !== 'pending_ec_approval' &&
    event.status !== 'review_by_cohead';
  const facultyApproved =
    event.status === 'active' ||
    event.status === 'in_progress' ||
    event.status === 'completed';
  const approval =
    (headApproved ? 10 : 0) + (ecApproved ? 10 : 0) + (facultyApproved ? 10 : 0);

  let taskShare = 0;
  if (total > 0) {
    const taskProgressSum = approvedTasks.reduce((sum, t) => sum + (t.progress || 0), 0);
    taskShare = Math.round((taskProgressSum / (total * 100)) * 70);
  }

  return {
    overall: approval + taskShare,
    approval,
    taskShare,
    completed,
    total,
  };
}
