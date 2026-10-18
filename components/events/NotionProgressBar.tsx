'use client';

import { useId } from 'react';
import { CheckCircle2, Circle, Clock, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatPortalDate } from '@/lib/portal-date';

interface CommitteeTask {
  committee_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  not_started_tasks: number;
}

interface NotionProgressBarProps {
  committeeTasks: CommitteeTask[];
  eventDate?: string;
  headApproved?: boolean;
  ecApproved?: boolean;
  facultyApproved?: boolean;
  selectedCommittee?: string | null;
  onSelectCommittee?: (committeeName: string) => void;
}

function committeeStatus(committee: CommitteeTask) {
  if (committee.completed_tasks === committee.total_tasks && committee.total_tasks > 0) return 'completed';
  if (committee.in_progress_tasks > 0 || committee.completed_tasks > 0) return 'in_progress';
  return 'not_started';
}

function committeePct(committee: CommitteeTask) {
  return committee.total_tasks > 0 ? (committee.completed_tasks / committee.total_tasks) * 100 : 0;
}

export default function NotionProgressBar({
  committeeTasks,
  eventDate,
  selectedCommittee = null,
  onSelectCommittee,
}: NotionProgressBarProps) {
  const totalTasks = committeeTasks.reduce((sum, ct) => sum + ct.total_tasks, 0);
  const completedTasks = committeeTasks.reduce((sum, ct) => sum + ct.completed_tasks, 0);
  const inProgress = committeeTasks.reduce((sum, ct) => sum + ct.in_progress_tasks, 0);
  const pending = committeeTasks.reduce((sum, ct) => sum + ct.not_started_tasks, 0);
  const overall = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const ring = 2 * Math.PI * 42;
  const ringOffset = ring * (1 - overall / 100);
  const gradientId = `np-ring-${useId().replace(/:/g, '')}`;

  return (
    <div className="premium-panel rounded-2xl p-5 sm:p-6 overflow-hidden relative">
      <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-400/25 to-teal-400/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="relative mx-auto sm:mx-0 h-[116px] w-[116px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={ringOffset}
              initial={{ strokeDashoffset: ring }}
              animate={{ strokeDashoffset: ringOffset }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tracking-tight text-gray-900">{overall}%</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">complete</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">Event progress</p>
          <p className="mt-1 text-sm text-gray-600">
            {eventDate ? formatPortalDate(eventDate) : 'Date TBA'} · {completedTasks}/{totalTasks || 0} tasks done
          </p>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400"
              initial={{ width: 0 }}
              animate={{ width: `${overall}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Done', value: completedTasks, className: 'from-emerald-50 to-teal-50 text-emerald-700' },
              { label: 'Active', value: inProgress, className: 'from-indigo-50 to-sky-50 text-indigo-700' },
              { label: 'Pending', value: pending, className: 'from-slate-50 to-gray-50 text-slate-600' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl bg-gradient-to-br ${stat.className} px-3 py-2 text-center`}>
                <p className="text-lg font-bold leading-none">{stat.value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800">By committee</h3>
          <p className="text-xs text-gray-500">Tap a committee, then a task</p>
        </div>

        {totalTasks === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-gray-600">No tasks assigned yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {committeeTasks.map((committee, index) => {
              const status = committeeStatus(committee);
              const progress = committeePct(committee);
              const selected = selectedCommittee === committee.committee_name;
              return (
                <motion.button
                  type="button"
                  key={committee.committee_name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectCommittee?.(committee.committee_name)}
                  className={`w-full rounded-2xl border p-3.5 text-left transition ${
                    selected
                      ? 'border-indigo-400 bg-indigo-50/80 shadow-sm shadow-indigo-500/10'
                      : 'border-slate-200/80 bg-white/70 hover:border-indigo-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : status === 'in_progress' ? (
                      <Clock className="h-5 w-5 shrink-0 text-indigo-500" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{committee.committee_name}</p>
                        <p className="shrink-0 text-sm font-bold text-gray-900">{Math.round(progress)}%</p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          className={`h-full rounded-full ${
                            status === 'completed'
                              ? 'bg-emerald-500'
                              : status === 'in_progress'
                                ? 'bg-gradient-to-r from-indigo-500 to-teal-400'
                                : 'bg-slate-300'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.6, delay: 0.1 + index * 0.05 }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-gray-500">
                        {committee.completed_tasks} done · {committee.in_progress_tasks} active · {committee.not_started_tasks} pending
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
