'use client';

import { eventProgressTasks, type EventProgressTask } from '@/lib/event-progress';

export type EventProgressMark = {
  key: string;
  label: string;
  hint?: string;
  at: number;
  reached: boolean;
};

export function buildEventProgressMarks(
  tasks: Array<EventProgressTask & { id?: string; title?: string | null }> = [],
  approval = 0,
): EventProgressMark[] {
  const counted = eventProgressTasks(tasks);
  const marks: EventProgressMark[] = [
    {
      key: 'approval',
      label: 'Approval',
      hint: 'Head, EC, and faculty',
      at: 30,
      reached: approval >= 30,
    },
  ];
  const n = counted.length;
  if (!n) return marks;
  const doneCount = counted.filter(
    (task) => task.status === 'completed' || !!task.completed_at,
  ).length;
  const slice = 70 / n;
  // Only place Task N once that many tasks are actually complete. Evenly
  // spaced labels for unfinished work make a 50% fill look like Task 3 is done.
  for (let i = 0; i < doneCount; i += 1) {
    marks.push({
      key: `task-${i + 1}`,
      label: `Task ${i + 1}`,
      hint: `${doneCount} of ${n} tasks completed`,
      at: Math.round(30 + slice * (i + 1)),
      reached: true,
    });
  }
  return marks;
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function WavyEventProgressBar({
  percent,
  marks = [],
  className = '',
}: {
  percent: number;
  marks?: EventProgressMark[];
  className?: string;
}) {
  const fill = clampPct(percent);

  return (
    <div className={className}>
      {marks.length > 0 ? (
        <div className="relative mb-1.5 h-8">
          {marks.map((mark) => (
            <div
              key={mark.key}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${clampPct(mark.at)}%` }}
              title={mark.hint || mark.label}
            >
              <span
                className={`max-w-[4.5rem] truncate text-[10px] font-semibold leading-none ${
                  mark.reached ? 'text-indigo-700' : 'text-gray-400'
                }`}
              >
                {mark.label}
              </span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  mark.reached ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="iiche-event-progress-fill h-full" style={{ width: `${fill}%` }} />
        {marks.map((mark) => (
          <span
            key={`${mark.key}-tick`}
            className="progress-tick absolute top-0 z-[1] h-full w-px bg-white/80"
            style={{ left: `${clampPct(mark.at)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
