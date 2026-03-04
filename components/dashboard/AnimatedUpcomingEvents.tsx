'use client';

import { motion } from 'framer-motion';

interface UpcomingEvent {
    id: string;
    title: string;
    description: string;
    date: string;
}

interface AnimatedUpcomingEventsProps {
    events: UpcomingEvent[];
}

export default function AnimatedUpcomingEvents({ events }: AnimatedUpcomingEventsProps) {
    if (events.length === 0) {
        return (
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-600 text-center py-4"
            >
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
                    transition={{
                        duration: 0.4,
                        delay: index * 0.1,
                        ease: [0.25, 0.1, 0.25, 1]
                    }}
                    whileHover={{ x: 4 }}
                    className="border-l-4 border-blue-500 pl-4 py-2"
                >
                    <h4 className="font-bold text-gray-900">{event.title}</h4>
                    <p className="text-sm text-gray-600">{event.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {new Date(event.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </motion.div>
            ))}
        </div>
    );
}
