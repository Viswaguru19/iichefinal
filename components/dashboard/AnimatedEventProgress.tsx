'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, TrendingUp, CheckCircle2 } from 'lucide-react';

interface Event {
    id: string;
    title: string;
    status: string;
    progress: number;
    committees?: {
        name: string;
    };
}

interface AnimatedEventProgressProps {
    events: Event[];
}

export default function AnimatedEventProgress({ events }: AnimatedEventProgressProps) {
    const getEventMood = (event: Event) => {
        const p = event.progress;

        if (event.status === 'in_progress') {
            if (p >= 80) return {
                emoji: '🚀',
                label: 'Almost done',
                badge: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
                barGradient: 'from-emerald-400 via-teal-400 to-cyan-400',
                glowColor: 'shadow-emerald-500/50'
            };
            if (p >= 40) return {
                emoji: '⚙️',
                label: 'In Progress',
                badge: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
                barGradient: 'from-blue-400 via-indigo-400 to-purple-400',
                glowColor: 'shadow-blue-500/50'
            };
            return {
                emoji: '🌱',
                label: 'Just Started',
                badge: 'bg-gradient-to-r from-lime-500 to-green-500 text-white',
                barGradient: 'from-lime-400 via-green-400 to-emerald-400',
                glowColor: 'shadow-lime-500/50'
            };
        }

        if (event.status === 'approved') {
            return {
                emoji: '✅',
                label: 'Approved',
                badge: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white',
                barGradient: 'from-emerald-400 to-green-500',
                glowColor: 'shadow-emerald-500/50'
            };
        }

        return {
            emoji: '✨',
            label: 'Upcoming',
            badge: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white',
            barGradient: 'from-violet-400 to-purple-400',
            glowColor: 'shadow-violet-500/50'
        };
    };

    if (events.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
            >
                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No events in progress</p>
                <p className="text-gray-400 text-sm mt-1">Events will appear here once they're created</p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
            {events.map((event, index) => {
                const mood = getEventMood(event);
                const isHighProgress = event.progress >= 70;

                return (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.5,
                            delay: index * 0.1,
                            ease: [0.25, 0.1, 0.25, 1]
                        }}
                        whileHover={{
                            scale: 1.02,
                            transition: { duration: 0.2 }
                        }}
                    >
                        <Link
                            href={`/dashboard/event-detail/${event.id}`}
                            className="group relative border-2 border-gray-100 rounded-2xl p-5 block hover:border-blue-200 transition-all duration-300 bg-gradient-to-br from-white to-gray-50/50 hover:shadow-xl overflow-hidden"
                        >
                            {/* Animated background gradient on hover */}
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-indigo-50/0 to-purple-50/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                animate={{
                                    backgroundPosition: ['0% 0%', '100% 100%'],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    repeatType: 'reverse',
                                }}
                            />

                            <div className="relative z-10">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4 gap-3">
                                    <div className="flex items-start gap-3 flex-1">
                                        <motion.div
                                            className="text-2xl"
                                            animate={{
                                                y: [0, -4, 0],
                                                rotate: [0, 5, 0, -5, 0],
                                            }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                repeatType: 'loop',
                                                delay: index * 0.2,
                                            }}
                                        >
                                            {mood.emoji}
                                        </motion.div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-gray-900 text-base sm:text-lg tracking-tight group-hover:text-blue-600 transition-colors">
                                                {event.title}
                                            </h4>
                                            {event.committees?.name && (
                                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                                    {event.committees.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <motion.span
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: index * 0.1 + 0.2 }}
                                            className={`text-xs px-3 py-1.5 rounded-full font-bold shadow-lg ${mood.badge} ${mood.glowColor}`}
                                        >
                                            {mood.label}
                                        </motion.span>
                                        {isHighProgress && (
                                            <motion.div
                                                initial={{ scale: 0, rotate: -180 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                transition={{
                                                    delay: index * 0.1 + 0.4,
                                                    type: "spring",
                                                    stiffness: 200
                                                }}
                                            >
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Section */}
                                <div className="mt-4">
                                    <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            Progress
                                        </span>
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.1 + 0.5 }}
                                            className="font-bold text-base text-gray-900"
                                        >
                                            {event.progress}%
                                        </motion.span>
                                    </div>

                                    {/* Progress Bar Container */}
                                    <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                                        {/* Animated shimmer effect */}
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                            animate={{
                                                x: ['-100%', '200%'],
                                            }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                repeatDelay: 1,
                                                ease: 'easeInOut',
                                            }}
                                        />

                                        {/* Progress Bar */}
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${event.progress}%` }}
                                            transition={{
                                                duration: 1.5,
                                                delay: index * 0.1 + 0.6,
                                                ease: [0.34, 1.56, 0.64, 1]
                                            }}
                                            className={`relative h-full bg-gradient-to-r ${mood.barGradient} rounded-full shadow-lg`}
                                        >
                                            {/* Pulse effect at the end of progress bar */}
                                            {event.progress > 0 && (
                                                <motion.div
                                                    className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full"
                                                    animate={{
                                                        opacity: [0.4, 0.8, 0.4],
                                                        scale: [1, 1.2, 1],
                                                    }}
                                                    transition={{
                                                        duration: 1.5,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut',
                                                    }}
                                                />
                                            )}

                                            {/* Glowing effect */}
                                            <motion.div
                                                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 rounded-full"
                                                animate={{
                                                    x: ['-100%', '100%'],
                                                }}
                                                transition={{
                                                    duration: 2,
                                                    repeat: Infinity,
                                                    ease: 'linear',
                                                }}
                                            />
                                        </motion.div>
                                    </div>

                                    {/* Milestone indicators */}
                                    <div className="flex justify-between mt-2 px-1">
                                        {[25, 50, 75, 100].map((milestone) => (
                                            <motion.div
                                                key={milestone}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{
                                                    opacity: event.progress >= milestone ? 1 : 0.3,
                                                    y: 0
                                                }}
                                                transition={{ delay: index * 0.1 + 0.8 }}
                                                className={`text-[10px] font-medium ${event.progress >= milestone
                                                        ? 'text-blue-600'
                                                        : 'text-gray-400'
                                                    }`}
                                            >
                                                {milestone}%
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}
