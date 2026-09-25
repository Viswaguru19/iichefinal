'use client';

import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { formatPortalDate, formatPortalDateTime } from '@/lib/portal-date';

const ACCENT = [
    'from-blue-500 to-indigo-500',
    'from-violet-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
];

interface AnimatedUpcomingEventsProps {
    events: { id: string; title: string; description: string; date: string }[];
}

export default function AnimatedUpcomingEvents({ events }: AnimatedUpcomingEventsProps) {
    if (events.length === 0) {
        return (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-gray-400 text-center py-6 font-medium">
                No upcoming events
            </motion.p>
        );
    }

    return (
        <div className="space-y-4">
            {events.map((event, index) => (
                <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                    whileHover={{ x: 6 }}
                    className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/60 transition-all group"
                >
                    {/* Date badge */}
                    <div className={`flex-shrink-0 w-16 h-14 rounded-xl bg-gradient-to-br ${ACCENT[index % ACCENT.length]} flex flex-col items-center justify-center text-white shadow-md px-1`}>
                        <span className="text-[10px] font-black leading-none tracking-wide">
                            {formatPortalDate(event.date).slice(0, 5)}
                        </span>
                        <span className="text-[11px] font-bold leading-tight mt-0.5">
                            {formatPortalDate(event.date).slice(6)}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{event.title}</h4>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{event.description}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatPortalDateTime(event.date)}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
