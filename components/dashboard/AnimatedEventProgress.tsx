'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import EventApprovalTrail, { eventApprovalFlags, type EventApprovalSource } from '@/components/events/EventApprovalTrail';
import { computeEventOverallProgress } from '@/lib/event-progress';

interface Task {
    id: string;
    title: string;
    status: string;
    progress?: number | null;
    assigned_committee?: { name: string } | null;
    completed_at?: string | null;
}

interface Event extends EventApprovalSource {
    id: string;
    title: string;
    committees?: { name: string };
    tasks?: Task[];
}

interface AnimatedEventProgressProps {
    events: Event[];
}

export default function AnimatedEventProgress({ events }: AnimatedEventProgressProps) {
    if (events.length === 0) {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center py-14">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                    <Sparkles className="w-14 h-14 text-indigo-200 mx-auto mb-4" />
                </motion.div>
                <p className="text-gray-400 font-semibold">No events in progress</p>
                <p className="text-gray-300 text-sm mt-1">Events appear here once faculty-approved</p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-5">
            {events.map((event, index) => {
                const steps = eventApprovalFlags(event.status);
                const tasks = event.tasks || [];
                const { overall: progress, completed: completedCount, total: totalCount } = computeEventOverallProgress(event, tasks);
                const completedTasks = tasks.filter(t => t.status === 'completed' || t.completed_at);
                const allTasksDone = totalCount > 0 && completedCount === totalCount;

                return (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.08 }}
                    >
                        <Link
                            href={`/dashboard/event-detail/${event.id}`}
                            className="group block glass rounded-2xl p-5 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                        >
                            {/* Decorative gradient orb */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-400/10 to-purple-400/10 blur-2xl group-hover:from-indigo-400/20 group-hover:to-purple-400/20 transition-all duration-500" />

                            {/* Title */}
                            <div className="flex justify-between items-start mb-5 relative z-10">
                                <div>
                                    <h4 className="font-bold text-gray-900 text-lg group-hover:text-gradient transition-all">
                                        {event.title}
                                    </h4>
                                    {event.committees?.name && (
                                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400" />
                                            {event.committees.name}
                                        </p>
                                    )}
                                </div>
                                {allTasksDone && tasks.length > 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                                        className="text-[10px] px-3 py-1.5 rounded-full font-bold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md"
                                    >
                                        ✨ All Done
                                    </motion.span>
                                )}
                            </div>

                            <EventApprovalTrail event={event} className="mb-5 relative z-10" />

                            {/* Tasks Section */}
                            {steps.facultyDone && tasks.length > 0 && (
                                <div className="border-t border-gray-100/80 pt-4 relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Tasks ({completedCount}/{totalCount})
                                        </p>
                                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                                    </div>

                                    <div className="mb-4 flex items-center gap-3">
                                        <div className="relative h-12 w-12 shrink-0">
                                            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                                                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                                                <motion.circle
                                                    cx="18"
                                                    cy="18"
                                                    r="14"
                                                    fill="none"
                                                    stroke={`url(#dash-task-ring-${event.id})`}
                                                    strokeWidth="4"
                                                    strokeLinecap="round"
                                                    strokeDasharray={2 * Math.PI * 14}
                                                    initial={{ strokeDashoffset: 2 * Math.PI * 14 }}
                                                    animate={{ strokeDashoffset: 2 * Math.PI * 14 * (1 - progress / 100) }}
                                                    transition={{ duration: 1, delay: index * 0.08 + 0.35, ease: [0.22, 1, 0.36, 1] }}
                                                />
                                                <defs>
                                                    <linearGradient id={`dash-task-ring-${event.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#6366f1" />
                                                        <stop offset="100%" stopColor="#14b8a6" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-800">
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 1, delay: index * 0.08 + 0.35, ease: [0.22, 1, 0.36, 1] }}
                                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400"
                                                />
                                            </div>
                                            <p className="mt-1 text-[11px] text-gray-500">
                                                Overall progress · {completedCount} of {totalCount} tasks
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {tasks.map((task) => {
                                            const isDone = task.status === 'completed' || !!task.completed_at;
                                            return (
                                                <div
                                                    key={task.id}
                                                    className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${
                                                        isDone
                                                            ? 'bg-gradient-to-r from-indigo-50 via-violet-50 to-teal-50 ring-1 ring-indigo-100/70'
                                                            : ''
                                                    }`}
                                                >
                                                    {isDone ? (
                                                        <span className="w-1 self-stretch min-h-[1.5rem] rounded-full bg-gradient-to-b from-indigo-500 to-teal-400 shrink-0" />
                                                    ) : null}
                                                    {isDone ? (
                                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center flex-shrink-0">
                                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                                        </div>
                                                    ) : (
                                                        <Clock className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                                    )}
                                                    <span className={`text-sm flex-1 ${isDone ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                                        {task.title}
                                                    </span>
                                                    {isDone && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-indigo-700 font-semibold shrink-0 ring-1 ring-indigo-100">
                                                            Done
                                                        </span>
                                                    )}
                                                    {task.assigned_committee?.name && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-indigo-500 font-medium">
                                                            {task.assigned_committee.name}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {steps.facultyDone && tasks.length === 0 && (
                                <div className="border-t border-gray-100/80 pt-4 relative z-10">
                                    <p className="text-sm text-gray-300 text-center">No tasks assigned yet</p>
                                </div>
                            )}
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}
