'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock, Users, Calendar, Sparkles, TrendingUp, Target, Zap, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

interface CommitteeTask {
    committee_name: string;
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    not_started_tasks: number;
}

interface PremiumInteractiveProgressProps {
    committeeTasks: CommitteeTask[];
    eventDate?: string;
}

export default function PremiumInteractiveProgress({ committeeTasks, eventDate }: PremiumInteractiveProgressProps) {
    const [darkMode, setDarkMode] = useState(false);
    const [selectedCommittee, setSelectedCommittee] = useState<number | null>(null);
    const [hoveredCard, setHoveredCard] = useState<number | null>(null);

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

    // Theme colors
    const theme = darkMode ? {
        bg: 'bg-gray-900',
        cardBg: 'bg-gray-800',
        border: 'border-gray-700',
        text: 'text-gray-100',
        textSecondary: 'text-gray-400',
        hover: 'hover:bg-gray-750',
        progressBg: 'bg-gray-700',
        shadow: 'shadow-2xl shadow-blue-500/20'
    } : {
        bg: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50',
        cardBg: 'bg-white',
        border: 'border-gray-200',
        text: 'text-gray-900',
        textSecondary: 'text-gray-600',
        hover: 'hover:bg-gray-50',
        progressBg: 'bg-gray-100',
        shadow: 'shadow-xl shadow-blue-200/50'
    };

    return (
        <div className={`w-full p-8 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'} transition-all duration-500`}>
            {/* Header with Dark Mode Toggle */}
            <div className="flex items-center justify-between mb-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3"
                >
                    <Sparkles className={`w-6 h-6 ${darkMode ? 'text-yellow-400' : 'text-purple-600'}`} />
                    <h3 className={`text-2xl font-bold ${theme.text}`}>Event Progress</h3>
                </motion.div>

                {/* Dark Mode Toggle */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDarkMode(!darkMode)}
                    className={`p-3 rounded-xl ${theme.cardBg} ${theme.border} border-2 ${theme.shadow} transition-all duration-300`}
                >
                    <AnimatePresence mode="wait">
                        {darkMode ? (
                            <motion.div
                                key="sun"
                                initial={{ rotate: -180, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 180, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Sun className="w-5 h-5 text-yellow-400" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="moon"
                                initial={{ rotate: 180, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: -180, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Moon className="w-5 h-5 text-indigo-600" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>

            {/* Event Date - Premium Style */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mb-8"
            >
                <div className={`${theme.cardBg} ${theme.border} border-2 rounded-2xl p-6 ${theme.shadow} backdrop-blur-sm`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                className={`p-3 rounded-xl ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}
                            >
                                <Calendar className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                            </motion.div>
                            <div>
                                <p className={`text-sm font-medium ${theme.textSecondary}`}>Event Date</p>
                                <p className={`text-xl font-bold ${theme.text}`}>
                                    {eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    }) : 'TBD'}
                                </p>
                            </div>
                        </div>
                        {eventDate && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3, type: 'spring' }}
                                className={`px-4 py-2 rounded-full ${darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'} font-semibold text-sm`}
                            >
                                {Math.ceil((new Date(eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Overall Progress - Ultra Premium */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`${theme.cardBg} ${theme.border} border-2 rounded-2xl p-8 mb-8 ${theme.shadow} backdrop-blur-sm relative overflow-hidden`}
            >
                {/* Animated Background Gradient */}
                <motion.div
                    className="absolute inset-0 opacity-10"
                    animate={{
                        background: [
                            'linear-gradient(45deg, #3b82f6 0%, #8b5cf6 100%)',
                            'linear-gradient(45deg, #8b5cf6 0%, #ec4899 100%)',
                            'linear-gradient(45deg, #ec4899 0%, #3b82f6 100%)',
                        ],
                    }}
                    transition={{ duration: 10, repeat: Infinity }}
                />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                            <h4 className={`text-lg font-bold ${theme.text}`}>Overall Progress</h4>
                        </div>
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-right"
                        >
                            <p className={`text-4xl font-black bg-gradient-to-r ${darkMode ? 'from-blue-400 to-purple-400' : 'from-blue-600 to-purple-600'} bg-clip-text text-transparent`}>
                                {Math.round(progressPercentage)}%
                            </p>
                            <p className={`text-sm ${theme.textSecondary}`}>{completedTasks}/{totalTasks} tasks</p>
                        </motion.div>
                    </div>

                    {/* Premium Progress Bar with Particles */}
                    <div className="relative">
                        <div className={`h-4 ${theme.progressBg} rounded-full overflow-hidden relative`}>
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercentage}%` }}
                                transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                            />

                            {/* Shimmer Effect */}
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            />

                            {/* Particles */}
                            {[...Array(5)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-2 h-2 bg-white rounded-full"
                                    style={{ left: `${(i + 1) * 15}%`, top: '25%' }}
                                    animate={{
                                        y: [-5, 5, -5],
                                        opacity: [0.5, 1, 0.5],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Progress Milestones */}
                        <div className="flex justify-between mt-2 text-xs">
                            {[0, 25, 50, 75, 100].map((milestone) => (
                                <motion.span
                                    key={milestone}
                                    className={progressPercentage >= milestone ? (darkMode ? 'text-blue-400' : 'text-blue-600') : theme.textSecondary}
                                    animate={progressPercentage >= milestone ? { scale: [1, 1.2, 1] } : {}}
                                    transition={{ duration: 0.3 }}
                                >
                                    {milestone}%
                                </motion.span>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Committee Cards - Interactive Grid */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <AnimatePresence>
                    {committeeTasks.map((committee, index) => {
                        const status = getCommitteeStatus(committee);
                        const progress = getCommitteeProgress(committee);
                        const isSelected = selectedCommittee === index;
                        const isHovered = hoveredCard === index;

                        return (
                            <motion.div
                                key={committee.committee_name}
                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                                whileHover={{ scale: 1.02, y: -5 }}
                                onHoverStart={() => setHoveredCard(index)}
                                onHoverEnd={() => setHoveredCard(null)}
                                onClick={() => setSelectedCommittee(isSelected ? null : index)}
                                className={`${theme.cardBg} ${theme.border} border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative overflow-hidden ${isSelected ? (darkMode ? 'ring-4 ring-blue-500/50' : 'ring-4 ring-blue-400/50') : ''
                                    } ${theme.shadow}`}
                            >
                                {/* Animated Background on Hover */}
                                <motion.div
                                    className={`absolute inset-0 ${darkMode ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10' : 'bg-gradient-to-br from-blue-100/50 to-purple-100/50'}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: isHovered || isSelected ? 1 : 0 }}
                                    transition={{ duration: 0.3 }}
                                />

                                <div className="relative z-10">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3 flex-1">
                                            <motion.div
                                                animate={isHovered ? { rotate: 360 } : {}}
                                                transition={{ duration: 0.5 }}
                                                className={`p-3 rounded-xl ${status === 'completed'
                                                        ? (darkMode ? 'bg-green-500/20' : 'bg-green-100')
                                                        : status === 'in_progress'
                                                            ? (darkMode ? 'bg-blue-500/20' : 'bg-blue-100')
                                                            : (darkMode ? 'bg-gray-700' : 'bg-gray-100')
                                                    }`}
                                            >
                                                {status === 'completed' ? (
                                                    <CheckCircle className={`w-6 h-6 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                                                ) : status === 'in_progress' ? (
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                                    >
                                                        <Clock className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                                                    </motion.div>
                                                ) : (
                                                    <Circle className={`w-6 h-6 ${theme.textSecondary}`} />
                                                )}
                                            </motion.div>

                                            <div className="flex-1">
                                                <h5 className={`font-bold ${theme.text} text-lg`}>{committee.committee_name}</h5>
                                                <p className={`text-sm ${theme.textSecondary}`}>
                                                    {committee.completed_tasks}/{committee.total_tasks} completed
                                                </p>
                                            </div>
                                        </div>

                                        <motion.div
                                            animate={{ scale: isHovered ? 1.2 : 1 }}
                                            className={`text-2xl font-black ${status === 'completed'
                                                    ? (darkMode ? 'text-green-400' : 'text-green-600')
                                                    : status === 'in_progress'
                                                        ? (darkMode ? 'text-blue-400' : 'text-blue-600')
                                                        : theme.textSecondary
                                                }`}
                                        >
                                            {Math.round(progress)}%
                                        </motion.div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className={`h-3 ${theme.progressBg} rounded-full overflow-hidden mb-4`}>
                                        <motion.div
                                            className={`h-full rounded-full ${status === 'completed'
                                                    ? 'bg-gradient-to-r from-green-400 to-green-600'
                                                    : status === 'in_progress'
                                                        ? 'bg-gradient-to-r from-blue-400 to-purple-600'
                                                        : 'bg-gray-400'
                                                }`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                                        />
                                    </div>

                                    {/* Task Breakdown */}
                                    <div className="flex items-center gap-4 text-sm">
                                        {committee.completed_tasks > 0 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: 0.6 + index * 0.1 }}
                                                className="flex items-center gap-2"
                                            >
                                                <div className={`w-3 h-3 rounded-full ${darkMode ? 'bg-green-400' : 'bg-green-500'}`} />
                                                <span className={theme.textSecondary}>{committee.completed_tasks} done</span>
                                            </motion.div>
                                        )}
                                        {committee.in_progress_tasks > 0 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: 0.7 + index * 0.1 }}
                                                className="flex items-center gap-2"
                                            >
                                                <motion.div
                                                    className={`w-3 h-3 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-500'}`}
                                                    animate={{ scale: [1, 1.3, 1] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                />
                                                <span className={theme.textSecondary}>{committee.in_progress_tasks} active</span>
                                            </motion.div>
                                        )}
                                        {committee.not_started_tasks > 0 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: 0.8 + index * 0.1 }}
                                                className="flex items-center gap-2"
                                            >
                                                <div className={`w-3 h-3 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                                                <span className={theme.textSecondary}>{committee.not_started_tasks} pending</span>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Expanded Details */}
                                    <AnimatePresence>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                                            >
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Zap className={`w-4 h-4 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                                                    <span className={theme.text}>Click to see task details</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Glow Effect on Hover */}
                                {isHovered && (
                                    <motion.div
                                        className="absolute inset-0 rounded-2xl"
                                        style={{
                                            boxShadow: darkMode
                                                ? '0 0 30px rgba(59, 130, 246, 0.3)'
                                                : '0 0 30px rgba(59, 130, 246, 0.2)',
                                        }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    />
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Summary Stats - Premium Cards */}
            {totalTasks > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="grid grid-cols-4 gap-4"
                >
                    {[
                        { label: 'Completed', value: completedTasks, icon: CheckCircle, color: 'green', gradient: 'from-green-400 to-green-600' },
                        { label: 'In Progress', value: committeeTasks.reduce((sum, ct) => sum + ct.in_progress_tasks, 0), icon: Clock, color: 'blue', gradient: 'from-blue-400 to-blue-600' },
                        { label: 'Pending', value: committeeTasks.reduce((sum, ct) => sum + ct.not_started_tasks, 0), icon: Target, color: 'gray', gradient: 'from-gray-400 to-gray-600' },
                        { label: 'Committees', value: committeeTasks.length, icon: Users, color: 'purple', gradient: 'from-purple-400 to-purple-600' },
                    ].map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ duration: 0.5, delay: 0.9 + index * 0.1, type: 'spring' }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            className={`${theme.cardBg} ${theme.border} border-2 rounded-xl p-4 text-center ${theme.shadow} relative overflow-hidden`}
                        >
                            <motion.div
                                className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-10`}
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />
                            <div className="relative z-10">
                                <stat.icon className={`w-6 h-6 mx-auto mb-2 ${darkMode ? `text-${stat.color}-400` : `text-${stat.color}-600`}`} />
                                <motion.p
                                    className={`text-3xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                                >
                                    {stat.value}
                                </motion.p>
                                <p className={`text-xs ${theme.textSecondary} mt-1 font-medium`}>{stat.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* No Tasks State */}
            {totalTasks === 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className={`${theme.cardBg} ${theme.border} border-2 rounded-2xl p-12 text-center ${theme.shadow}`}
                >
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <Target className={`w-16 h-16 mx-auto mb-4 ${theme.textSecondary}`} />
                    </motion.div>
                    <p className={`text-lg font-semibold ${theme.text} mb-2`}>No tasks assigned yet</p>
                    <p className={`text-sm ${theme.textSecondary}`}>Assign tasks to committees to start tracking progress</p>
                </motion.div>
            )}
        </div>
    );
}
