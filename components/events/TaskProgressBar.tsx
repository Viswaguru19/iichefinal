'use client';

import { CheckCircle, Clock, Circle, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface CommitteeTask {
    committee_name: string;
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    not_started_tasks: number;
}

interface TaskProgressBarProps {
    committeeTasks: CommitteeTask[];
    eventDate?: string;
}

export default function TaskProgressBar({ committeeTasks, eventDate }: TaskProgressBarProps) {
    const totalTasks = committeeTasks.reduce((sum, ct) => sum + ct.total_tasks, 0);
    const completedTasks = committeeTasks.reduce((sum, ct) => sum + ct.completed_tasks, 0);
    const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const getCommitteeStatus = (committee: CommitteeTask) => {
        if (committee.completed_tasks === committee.total_tasks) return 'completed';
        if (committee.in_progress_tasks > 0 || committee.completed_tasks > 0) return 'in_progress';
        return 'not_started';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500';
            case 'in_progress':
                return 'bg-blue-500';
            default:
                return 'bg-gray-300';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-6 h-6 text-white" />;
            case 'in_progress':
                return <Clock className="w-6 h-6 text-white animate-pulse" />;
            default:
                return <Circle className="w-6 h-6 text-white opacity-50" />;
        }
    };

    return (
        <div className="w-full py-8">
            {/* Event Date Display */}
            <div className="mb-8 text-center">
                <div className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full shadow-lg">
                    <p className="text-sm font-medium">Event Date</p>
                    <p className="text-2xl font-bold">
                        {eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : 'TBD'}
                    </p>
                </div>
            </div>

            {/* Overall Progress */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900">Overall Event Progress</h3>
                    <span className="text-2xl font-bold text-blue-600">{Math.round(progressPercentage)}%</span>
                </div>

                {/* Animated Progress Bar */}
                <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                            background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                    />

                    {/* Shimmer Effect */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    />
                </div>

                <div className="flex justify-between text-sm text-gray-600 mt-2">
                    <span>{completedTasks} of {totalTasks} tasks completed</span>
                    <span>{totalTasks - completedTasks} remaining</span>
                </div>
            </div>

            {/* Committee Checkpoints */}
            <div className="relative mb-12">
                {/* Background Line */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2" />

                {/* Animated Progress Line */}
                {committeeTasks.length > 0 && (
                    <motion.div
                        className="absolute top-1/2 left-0 h-1 -translate-y-1/2"
                        style={{
                            background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%)',
                        }}
                        initial={{ width: 0 }}
                        animate={{
                            width: `${(completedTasks / totalTasks) * 100}%`
                        }}
                        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                    />
                )}

                {/* Committee Nodes */}
                <div className="relative flex justify-between">
                    {committeeTasks.map((committee, index) => {
                        const status = getCommitteeStatus(committee);
                        const committeeProgress = committee.total_tasks > 0
                            ? (committee.completed_tasks / committee.total_tasks) * 100
                            : 0;

                        return (
                            <motion.div
                                key={index}
                                className="flex flex-col items-center"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5 + index * 0.2, duration: 0.5 }}
                            >
                                {/* Node Circle */}
                                <motion.div
                                    className={`w-16 h-16 rounded-full flex items-center justify-center ${getStatusColor(status)} shadow-lg relative z-10 border-4 border-white`}
                                    whileHover={{ scale: 1.15, rotate: 5 }}
                                    animate={
                                        status === 'in_progress'
                                            ? {
                                                boxShadow: [
                                                    '0 0 0 0 rgba(59, 130, 246, 0.7)',
                                                    '0 0 0 15px rgba(59, 130, 246, 0)',
                                                ],
                                            }
                                            : {}
                                    }
                                    transition={
                                        status === 'in_progress'
                                            ? {
                                                duration: 1.5,
                                                repeat: Infinity,
                                                repeatType: 'loop',
                                            }
                                            : {}
                                    }
                                >
                                    {getStatusIcon(status)}
                                </motion.div>

                                {/* Committee Info Card */}
                                <motion.div
                                    className="mt-4 bg-white rounded-lg shadow-md p-4 min-w-[160px] max-w-[180px]"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.7 + index * 0.2 }}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="w-4 h-4 text-blue-600" />
                                        <p className="font-bold text-gray-900 text-sm truncate">
                                            {committee.committee_name}
                                        </p>
                                    </div>

                                    {/* Mini Progress Bar */}
                                    <div className="mb-2">
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <motion.div
                                                className={`h-full ${status === 'completed' ? 'bg-green-500' : status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-400'}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${committeeProgress}%` }}
                                                transition={{ duration: 1, delay: 1 + index * 0.2 }}
                                            />
                                        </div>
                                    </div>

                                    {/* Task Stats */}
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Total:</span>
                                            <span className="font-semibold text-gray-900">{committee.total_tasks}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-green-600">Done:</span>
                                            <span className="font-semibold text-green-600">{committee.completed_tasks}</span>
                                        </div>
                                        {committee.in_progress_tasks > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-blue-600">In Progress:</span>
                                                <span className="font-semibold text-blue-600">{committee.in_progress_tasks}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Badge */}
                                    <motion.div
                                        className={`mt-2 text-center py-1 rounded-full text-xs font-bold ${status === 'completed'
                                                ? 'bg-green-100 text-green-700'
                                                : status === 'in_progress'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}
                                        animate={
                                            status === 'in_progress'
                                                ? { opacity: [1, 0.6, 1] }
                                                : {}
                                        }
                                        transition={
                                            status === 'in_progress'
                                                ? { duration: 2, repeat: Infinity }
                                                : {}
                                        }
                                    >
                                        {status === 'completed' ? '✓ Complete' :
                                            status === 'in_progress' ? '⏳ In Progress' :
                                                '○ Not Started'}
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Progress Statistics */}
            <div className="grid grid-cols-4 gap-4">
                <motion.div
                    className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 shadow-md text-center border-2 border-green-200"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.5 }}
                >
                    <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
                    <p className="text-sm text-green-700 font-medium">Completed</p>
                </motion.div>

                <motion.div
                    className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 shadow-md text-center border-2 border-blue-200"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.6 }}
                >
                    <p className="text-3xl font-bold text-blue-600">
                        {committeeTasks.reduce((sum, ct) => sum + ct.in_progress_tasks, 0)}
                    </p>
                    <p className="text-sm text-blue-700 font-medium">In Progress</p>
                </motion.div>

                <motion.div
                    className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 shadow-md text-center border-2 border-gray-200"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.7 }}
                >
                    <p className="text-3xl font-bold text-gray-600">
                        {committeeTasks.reduce((sum, ct) => sum + ct.not_started_tasks, 0)}
                    </p>
                    <p className="text-sm text-gray-700 font-medium">Not Started</p>
                </motion.div>

                <motion.div
                    className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 shadow-md text-center border-2 border-purple-200"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.8 }}
                >
                    <p className="text-3xl font-bold text-purple-600">{committeeTasks.length}</p>
                    <p className="text-sm text-purple-700 font-medium">Committees</p>
                </motion.div>
            </div>

            {/* No Tasks Message */}
            {totalTasks === 0 && (
                <motion.div
                    className="mt-8 text-center py-8 bg-yellow-50 rounded-xl border-2 border-yellow-200"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <Clock className="w-12 h-12 mx-auto mb-3 text-yellow-600" />
                    <p className="text-yellow-800 font-medium">No tasks assigned yet</p>
                    <p className="text-yellow-600 text-sm mt-1">Assign tasks to committees to track progress</p>
                </motion.div>
            )}
        </div>
    );
}
