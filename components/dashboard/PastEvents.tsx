'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { CheckCircle2, Calendar, MapPin, ChevronDown, ChevronUp, FileText, Camera, ImageIcon } from 'lucide-react';

interface PastEvent {
    id: string;
    title: string;
    status: string;
    event_date?: string;
    location?: string;
    description?: string;
    committees?: { name: string };
}

export default function PastEvents({ events }: { events: PastEvent[] }) {
    const [expanded, setExpanded] = useState(false);

    if (events.length === 0) {
        return (
            <div className="text-center py-10">
                <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No past events yet</p>
                <p className="text-gray-300 text-sm mt-1">Completed events will appear here</p>
            </div>
        );
    }

    const visible = expanded ? events : events.slice(0, 4);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                    {visible.map((event, i) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                        >
                            <Link
                                href={`/dashboard/event-detail/${event.id}`}
                                className="group block glass-strong rounded-2xl p-5 hover:shadow-xl transition-all duration-300 relative overflow-hidden border border-transparent hover:border-emerald-200"
                            >
                                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400/10 to-green-400/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="flex items-start justify-between mb-3 relative z-10">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-800 group-hover:text-emerald-700 transition-colors truncate">
                                            {event.title}
                                        </h4>
                                        {event.committees?.name && (
                                            <p className="text-xs text-gray-400 mt-1">{event.committees.name}</p>
                                        )}
                                    </div>
                                    <span className="flex-shrink-0 ml-3 text-[10px] px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                        Completed
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-gray-400 relative z-10">
                                    {event.event_date && (
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    )}
                                    {event.location && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {event.location}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400 relative z-10">
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-500">
                                        <FileText className="w-3 h-3" /> Report
                                    </span>
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-500">
                                        <Camera className="w-3 h-3" /> Photos
                                    </span>
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500">
                                        <ImageIcon className="w-3 h-3" /> Poster
                                    </span>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {events.length > 4 && (
                <div className="text-center mt-4">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors px-4 py-2 rounded-xl hover:bg-indigo-50"
                    >
                        {expanded ? <><ChevronUp className="w-4 h-4" /> Show Less</> : <><ChevronDown className="w-4 h-4" /> Show All ({events.length})</>}
                    </button>
                </div>
            )}
        </div>
    );
}
