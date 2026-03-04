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
}

export default function NotionProgressBar({ committeeTasks, eventDate }: NotionProgressBarProps) {
    const totalTasks = committeeTasks.reduce((sum, ct) => sum + ct.total_tasks, 0);
    const completedTasks = committeeTasks.reduce((sum, ct) => sum + ct.completed_tasks, 0);
    const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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

            {/* Overall Progress - Notion Style */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                className="space-y-3"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm font-semibold text-gray-900">
                        {completedTasks}/{totalTasks} tasks
                    </span>
                </div>

                {/* Notion-style Progress Timeline with Checkpoints */}
                <div className="space-y-2">
                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                        {/* Filled progress line */}
                        <motion.div
                            className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{
                                duration: 0.8,
                                delay: 0.2,
                                ease: [0.25, 0.1, 0.25, 1]
                            }}
                        />

                        {/* Checkpoints for each committee */}
                        {committeeTasks.map((committee, index) => {
                            const status = getCommitteeStatus(committee);
                            const isCompleted = status === 'completed';
                            const isInProgress = status === 'in_progress';
                            const position =
                                committeeTasks.length === 1
                                    ? 50
                                    : (index / (committeeTasks.length - 1)) * 100;

                            return (
                                <motion.div
                                    key={committee.committee_name}
                                    className="absolute -top-1.5"
                                    style={{
                                        left: `${position}%`,
                                        transform: 'translateX(-50%)',
                                    }}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{
                                        delay: 0.25 + index * 0.05,
                                        duration: 0.25,
                                        ease: [0.25, 0.1, 0.25, 1],
                                    }}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${isCompleted
                                            ? 'border-green-500'
                                            : isInProgress
                                                ? 'border-blue-500'
                                                : 'border-gray-300'
                                            }`}
                                    >
                                        <div
                                            className={`w-2 h-2 rounded-full ${isCompleted
                                                ? 'bg-green-500'
                                                : isInProgress
                                                    ? 'bg-blue-500'
                                                    : 'bg-gray-300'
                                                }`}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="text-base font-bold text-blue-600">{Math.round(progressPercentage)}% complete</span>
                        {totalTasks - completedTasks > 0 && (
                            <span className="font-medium">{totalTasks - completedTasks} tasks remaining</span>
                        )}
                    </div>
                </div>
            </motion.div>

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
