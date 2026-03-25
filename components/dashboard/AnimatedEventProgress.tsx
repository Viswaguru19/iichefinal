'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, CheckCircle2, Circle, Clock, ArrowRight } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    status: string;
    assigned_committee?: { name: string } | null;
    completed_at?: string | null;
}

interface Event {
    id: string;
    title: string;
    status: string;
    committees?: { name: string };
    head_approved_by?: string | null;
    faculty_approved_by?: string | null;
    tasks?: Task[];
}

interface AnimatedEventProgressProps {
    events: Event[];
}

const APPROVAL_STEPS = [
    { key: 'head', label: 'Head Approved', gradient: 'from-amber-400 to-orange-500' },
    { key: 'ec', label: 'EC Approved', gradient: 'from-blue-400 to-indigo-500' },
    { key: 'faculty', label: 'Faculty Approved', gradient: 'from-emerald-400 to-green-500' },
];

function getStepStatus(event: Event) {
    const s = event.status;
    const headDone = s !== 'pending_head_approval' && s !== 'draft' && s !== 'review_by_cohead';
    const ecDone = headDone && s !== 'pending_ec_approval' && s !== 'rejected_by_head';
    const facultyDone = ecDone && (s === 'active' || s === 'completed' || s === 'in_progress' || s === 'faculty_approved');
    return { headDone, ecDone, facultyDone };
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
                const steps = getStepStatus(event);
                const tasks = event.tasks || [];
                const completedTasks = tasks.filter(t => t.status === 'completed' || t.completed_at);
                const allTasksDone = tasks.length > 0 && completedTasks.length === tasks.length;
                const progress = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

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

                            {/* Approval Steps */}
                            <div className="flex items-center gap-0 mb-5 relative z-10">
                                {APPROVAL_STEPS.map((step, i) => {
                                    const done = step.key === 'head' ? steps.headDone : step.key === 'ec' ? steps.ecDone : steps.facultyDone;
                                    return (
                                        <div key={step.key} className="flex items-center flex-1">
                                            <div className="flex flex-col items-center flex-1">
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ delay: index * 0.08 + i * 0.15, type: 'spring', stiffness: 200 }}
                                                >
                                                    {done ? (
                                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-md`}>
                                                            <CheckCircle2 className="w-5 h-5 text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                                                            <Circle className="w-4 h-4 text-gray-300" />
                                                        </div>
                                                    )}
                                                </motion.div>
                                                <span className={`text-[10px] mt-1.5 font-semibold ${done ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                            {i < APPROVAL_STEPS.length - 1 && (
                                                <div className="flex-shrink-0 w-8 -mt-4 mx-1">
                                                    <div className={`h-0.5 rounded-full ${done ? `bg-gradient-to-r ${step.gradient}` : 'bg-gray-200'}`} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Tasks Section */}
                            {steps.facultyDone && tasks.length > 0 && (
                                <div className="border-t border-gray-100/80 pt-4 relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Tasks ({completedTasks.length}/{tasks.length})
                                        </p>
                                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                                    </div>

                                    {/* Progress bar */}
                                    <div className="relative w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 1.2, delay: index * 0.08 + 0.5, ease: 'easeOut' }}
                                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        {tasks.map((task) => {
                                            const isDone = task.status === 'completed' || !!task.completed_at;
                                            return (
                                                <div key={task.id} className="flex items-center gap-3">
                                                    {isDone ? (
                                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center flex-shrink-0">
                                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                                        </div>
                                                    ) : (
                                                        <Clock className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                                    )}
                                                    <span className={`text-sm flex-1 ${isDone ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                                                        {task.title}
                                                    </span>
                                                    {task.assigned_committee?.name && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-medium">
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
