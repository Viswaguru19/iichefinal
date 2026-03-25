'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MapPin, CheckCircle2, FileText, Camera, ImageIcon, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';

export default function PastEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => { loadEvents(); }, []);

    async function loadEvents() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const { data } = await supabase
            .from('events')
            .select('*, committees(name)')
            .eq('status', 'completed')
            .order('event_date', { ascending: false });

        setEvents(data || []);
        setLoading(false);
    }

    const filtered = search
        ? events.filter(e =>
            e.title?.toLowerCase().includes(search.toLowerCase()) ||
            e.committees?.name?.toLowerCase().includes(search.toLowerCase())
        )
        : events;

    if (loading) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 mx-auto mb-4 animate-pulse-glow" />
                    <p className="text-gray-400">Loading past events...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-mesh">
            <PageHeader title="Past Events" />
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Search */}
                <div className="mb-6 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by event name or committee..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 glass-strong rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-300/50 transition-all"
                    />
                </div>

                {filtered.length === 0 ? (
                    <div className="glass rounded-2xl p-16 text-center">
                        <CheckCircle2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-600 mb-2">
                            {search ? 'No matching events' : 'No past events yet'}
                        </h3>
                        <p className="text-gray-400">
                            {search ? 'Try a different search term.' : 'Events will appear here once their report is created.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((event, i) => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: i * 0.04 }}
                            >
                                <Link
                                    href={`/dashboard/event-detail/${event.id}`}
                                    className="group block glass-strong rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-transparent hover:border-emerald-200"
                                >
                                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-green-500" />
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-800 group-hover:text-emerald-700 transition-colors truncate text-lg">
                                                    {event.title}
                                                </h3>
                                                {event.committees?.name && (
                                                    <p className="text-xs text-gray-400 mt-1">{event.committees.name}</p>
                                                )}
                                            </div>
                                            <span className="flex-shrink-0 ml-3 text-[10px] px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                Completed
                                            </span>
                                        </div>

                                        {event.description && (
                                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{event.description}</p>
                                        )}

                                        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
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

                                        <div className="flex items-center gap-2 text-[10px]">
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
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
