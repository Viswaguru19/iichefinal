'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

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
            if (p >= 80) return { emoji: '🚀', label: 'Almost done', badge: 'bg-emerald-100 text-emerald-800' };
            if (p >= 40) return { emoji: '⚙️', label: 'Work in progress', badge: 'bg-sky-100 text-sky-800' };
            return { emoji: '🌱', label: 'Just started', badge: 'bg-lime-100 text-lime-800' };
        }

        if (event.status === 'approved') {
            return { emoji: '✅', label: 'Approved', badge: 'bg-emerald-100 text-emerald-800' };
        }

        return { emoji: '✨', label: 'Upcoming', badge: 'bg-violet-100 text-violet-800' };
    };

    if (events.length === 0) {
        return (
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-600 text-center py-4"
            >
                No events in progress
            </motion.p>
        );
    }

    return (
        <div className="space-y-4">
            {events.map((event, index) => (
                // Each event card
                <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                        duration: 0.4,
                        delay: index * 0.1,
                        ease: [0.25, 0.1, 0.25, 1]
                    }}
                    whileHover={{ scale: 1.02 }}
                >
                    {(() => {
                        const mood = getEventMood(event);
                        return (
                            <Link
                                href={`/dashboard/event-detail/${event.id}`}
                                className="border border-gray-200 rounded-xl p-4 block hover:shadow-lg hover:border-blue-200 transition-all duration-300 bg-white/80 backdrop-blur-sm"
                            >
                                <div className="flex justify-between items-start mb-3 gap-3">
                                    <div className="flex items-start gap-3">
                                        <motion.span
                                            aria-hidden="true"
                                            className="text-xl"
                                            animate={{
                                                y: [0, -2, 0],
                                            }}
                                            transition={{
                                                duration: 1.8,
                                                repeat: Infinity,
                                                repeatType: 'loop',
                                                delay: index * 0.1,
                                            }}
                                        >
                                            {mood.emoji}
                                        </motion.span>
                                        <div>
                                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base tracking-tight">
                                                {event.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {event.committees?.name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <motion.span
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: index * 0.1 + 0.15 }}
                                            className={`text-[10px] sm:text-xs px-2 py-1 rounded-full font-semibold ${mood.badge}`}
                                        >
                                            {mood.label}
                                        </motion.span>
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ delay: index * 0.1 + 0.3 }}
                                            className="text-[10px] sm:text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium"
                                        >
                                            {event.status.replace('_', ' ').toUpperCase()}
                                        </motion.span>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <div className="flex justify-between text-[11px] sm:text-xs text-gray-600 mb-1">
                                        <span>Progress</span>
                                        <motion.span
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 + 0.35 }}
                                            className="font-medium text-gray-900"
                                        >
                                            {event.progress}%
                                        </motion.span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${event.progress}%` }}
                                            transition={{
                                                duration: 1,
                                                delay: index * 0.1 + 0.4,
                                                ease: [0.25, 0.1, 0.25, 1]
                                            }}
                                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            </Link>
                        );
                    })()}
                </motion.div>
            ))}
        </div>
    );
}
