'use client';

import { CheckCircle, Circle, Clock, Users, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
}

export default function NotionProgressBar({ committeeTasks, eventDate, headApproved = false, ecApproved = false, facultyApproved = false }: NotionProgressBarProps) {
    const totalTasks = committeeTasks.reduce((sum, ct) => sum + ct.total_tasks, 0);
    const completedTasks = committeeTasks.reduce((sum, ct) => sum + ct.completed_tasks, 0);

    // 30% from approvals + 70% from tasks
    const approvalProgress = (headApproved ? 10 : 0) + (ecApproved ? 10 : 0) + (facultyApproved ? 10 : 0);
    const taskProgressRaw = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const taskProgress = Math.round((taskProgressRaw / 100) * 70);
    const overallProgress = approvalProgress + taskProgress;

    const getCommitteeProgress = (committee: CommitteeTask) => {
        return committee.total_tasks > 0
            ? (committee.completed_tasks / committee.total_tasks) * 100
            : 0;
    };

    const getCommitteeStatus = (committee: CommitteeTask) => {
        if (committee.completed_tasks === committee.total_tasks && committee.total_tasks > 0) return 'completed';
        if (committee.in_progress_tasks > 0 || committee.completed_tasks > 0) return 'in_progress';
        return 'not_started';
    };

    return (
        <div className="w-full space-y-6">
            {/* Event Date - Notion Style */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex items-center gap-3 text-gray-700"
            >
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">Event Date</span>
                <span className="text-base font-semibold">
                    {eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }) : 'TBD'}
                </span>
            </motion.div>

            {/* Approval Pipeline */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500 mr-1">Approvals:</span>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${headApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {headApproved ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                    Head
                </div>
                <div className={`w-4 h-0.5 ${headApproved ? 'bg-green-400' : 'bg-gray-200'}`} />
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${ecApproved ? 'bg-green-100 text-green-700' : headApproved ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                    {ecApproved ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    EC
                </div>
                <div className={`w-4 h-0.5 ${ecApproved ? 'bg-green-400' : 'bg-gray-200'}`} />
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${facultyApproved ? 'bg-green-100 text-green-700' : ecApproved ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                    {facultyApproved ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    Faculty
                </div>
                <div className={`w-4 h-0.5 ${facultyApproved ? 'bg-green-400' : 'bg-gray-200'}`} />
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${facultyApproved ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    <Users className="w-3 h-3" />
                    Tasks
                </div>
            </div>

            {/* Overall Progress */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm font-bold text-gray-900">{overallProgress}%</span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 flex h-full rounded-full overflow-hidden" style={{ width: `${overallProgress}%` }}>
                        {approvalProgress > 0 && (
                            <div className="bg-green-500 h-full" style={{ width: `${(approvalProgress / overallProgress) * 100}%` }} />
                        )}
                        {taskProgress > 0 && (
                            <div className="bg-blue-500 h-full" style={{ width: `${(taskProgress / overallProgress) * 100}%` }} />
                        )}
                    </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                    <span>
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                        Approvals {approvalProgress}%
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ml-2 mr-1" />
                        Tasks {taskProgress}%
                    </span>
                    <span>{completedTasks}/{totalTasks} tasks done</span>
                </div>
            </div>

            {/* Committee Progress Cards - Notion Style */}
            <div className="space-y-3 mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Committee Progress</h3>

                <AnimatePresence>
                    {committeeTasks.map((committee, index) => {
                        const status = getCommitteeStatus(committee);
                        const progress = getCommitteeProgress(committee);

                        return (
                            <motion.div
                                key={committee.committee_name}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{
                                    duration: 0.3,
                                    delay: 0.3 + index * 0.1,
                                    ease: [0.25, 0.1, 0.25, 1]
                                }}
                                whileHover={{
                                    scale: 1.01,
                                    transition: { duration: 0.2 }
                                }}
                                className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
                            >
                                {/* Committee Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 flex-1">
                                        {/* Status Icon */}
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{
                                                duration: 0.3,
                                                delay: 0.4 + index * 0.1,
                                                ease: [0.34, 1.56, 0.64, 1]
                                            }}
                                        >
                                            {status === 'completed' ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : status === 'in_progress' ? (
                                                <Clock className="w-5 h-5 text-blue-500" />
                                            ) : (
                                                <Circle className="w-5 h-5 text-gray-300" />
                                            )}
                                        </motion.div>

                                        {/* Committee Name */}
                                        <div className="flex-1">
                                            <h4 className="text-sm font-semibold text-gray-900">
                                                {committee.committee_name}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {committee.completed_tasks} of {committee.total_tasks} completed
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress Percentage */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 + index * 0.1 }}
                                        className="flex flex-col items-end ml-3"
                                    >
                                        <span className="text-xl font-bold text-gray-900">
                                            {Math.round(progress)}%
                                        </span>
                                        <span className="text-xs text-gray-500 whitespace-nowrap">
                                            {committee.completed_tasks}/{committee.total_tasks} done
                                        </span>
                                    </motion.div>
                                </div>

                                {/* Progress Bar */}
                                <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div
                                        className={`absolute inset-y-0 left-0 rounded-full ${status === 'completed'
                                            ? 'bg-green-500'
                                            : status === 'in_progress'
                                                ? 'bg-blue-500'
                                                : 'bg-gray-300'
                                            }`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{
                                            duration: 0.6,
                                            delay: 0.5 + index * 0.1,
                                            ease: [0.25, 0.1, 0.25, 1]
                                        }}
                                    />
                                </div>

                                {/* Task Breakdown */}
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    transition={{ delay: 0.6 + index * 0.1 }}
                                    className="flex items-center gap-4 mt-3 text-xs"
                                >
                                    {committee.completed_tasks > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            <span className="text-gray-600">{committee.completed_tasks} done</span>
                                        </div>
                                    )}
                                    {committee.in_progress_tasks > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-gray-600">{committee.in_progress_tasks} in progress</span>
                                        </div>
                                    )}
                                    {committee.not_started_tasks > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-gray-300" />
                                            <span className="text-gray-600">{committee.not_started_tasks} pending</span>
                                        </div>
                                    )}
                                </motion.div>

                                {/* Hover Effect Border */}
                                <motion.div
                                    className="absolute inset-0 rounded-lg border-2 border-blue-500 opacity-0 group-hover:opacity-100 pointer-events-none"
                                    initial={false}
                                    transition={{ duration: 0.2 }}
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* No Tasks State */}
                {totalTasks === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                        className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300"
                    >
                        <Users className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                        <p className="text-sm font-medium text-gray-600">No tasks assigned yet</p>
                        <p className="text-xs text-gray-500 mt-1">Assign tasks to committees to track progress</p>
                    </motion.div>
                )}
            </div>

            {/* Summary Stats - Notion Style */}
            {totalTasks > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.4,
                        delay: 0.7 + committeeTasks.length * 0.1,
                        ease: [0.25, 0.1, 0.25, 1]
                    }}
                    className="grid grid-cols-4 gap-3 pt-4 border-t border-gray-200"
                >
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                        <div className="text-xs text-gray-500 mt-1">Completed</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                            {committeeTasks.reduce((sum, ct) => sum + ct.in_progress_tasks, 0)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">In Progress</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-400">
                            {committeeTasks.reduce((sum, ct) => sum + ct.not_started_tasks, 0)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Pending</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{committeeTasks.length}</div>
                        <div className="text-xs text-gray-500 mt-1">Committees</div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
