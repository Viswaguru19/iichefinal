'use client';

import { Check, Clock } from 'lucide-react';
import { formatPortalDate } from '@/lib/portal-date';

export type EventApprovalSource = {
  status: string;
  head_approved_by?: string | null;
  second_head_approved_by?: string | null;
  faculty_approved_by?: string | null;
  head_approved_at?: string | null;
  second_head_approved_at?: string | null;
  faculty_approved_at?: string | null;
  head_approver?: { name?: string } | null;
  second_head_approver?: { name?: string } | null;
  faculty_approver?: { name?: string } | null;
  ec_approvals?: {
    approved?: boolean;
    approved_at?: string | null;
    profiles?: { name?: string } | null;
  }[];
};

export type EventApprovalStep = {
  key: string;
  role: string;
  done: boolean;
  name?: string;
  at?: string;
};

export function eventApprovalFlags(status: string) {
  const headDone =
    status !== 'pending_head_approval' &&
    status !== 'draft' &&
    status !== 'review_by_cohead' &&
    status !== 'pending_second_head_approval';
  const ecDone = headDone && status !== 'pending_ec_approval' && status !== 'rejected_by_head';
  const facultyDone =
    ecDone &&
    (status === 'active' ||
      status === 'completed' ||
      status === 'in_progress' ||
      status === 'faculty_approved');
  return { headDone, ecDone, facultyDone };
}

export function buildEventApprovalSteps(event: EventApprovalSource): EventApprovalStep[] {
  const flags = eventApprovalFlags(event.status);
  const ecRows = (event.ec_approvals || []).filter((a) => a.approved);
  const ecNames = ecRows.map((a) => a.profiles?.name).filter(Boolean).join(', ');
  const lastEcAt = ecRows[ecRows.length - 1]?.approved_at || undefined;

  return [
    {
      key: 'head',
      role: event.second_head_approved_by ? 'Head 1' : 'Head',
      done: flags.headDone || !!event.head_approved_by,
      name: event.head_approver?.name,
      at: event.head_approved_at || undefined,
    },
    ...(event.second_head_approved_by
      ? [{
          key: 'head2',
          role: 'Head 2',
          done: true,
          name: event.second_head_approver?.name,
          at: event.second_head_approved_at || undefined,
        }]
      : []),
    {
      key: 'ec',
      role: 'EC',
      done: flags.ecDone,
      name: ecNames || undefined,
      at: lastEcAt,
    },
    {
      key: 'faculty',
      role: 'Faculty',
      done: flags.facultyDone || !!event.faculty_approved_by,
      name: event.faculty_approver?.name,
      at: event.faculty_approved_at || undefined,
    },
  ];
}

export default function EventApprovalTrail({
  event,
  className = '',
}: {
  event: EventApprovalSource;
  className?: string;
}) {
  const steps = buildEventApprovalSteps(event);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white px-2 py-3 sm:px-3 ${className}`}>
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        Approvals
      </p>
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.key} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-1 flex-col items-center px-0.5 text-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                  step.done
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Clock className="h-3.5 w-3.5" />}
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-gray-800">{step.role}</p>
              <p className={`text-[11px] leading-snug line-clamp-2 ${step.done ? 'text-gray-600' : 'text-gray-400'}`}>
                {step.done ? step.name || 'Approved' : 'Pending'}
              </p>
              {step.done && step.at && (
                <p className="mt-0.5 text-[10px] text-gray-400">{formatPortalDate(step.at)}</p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mt-3.5 h-px w-3 shrink-0 sm:w-6 ${
                  step.done ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
