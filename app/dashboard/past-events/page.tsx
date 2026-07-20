'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MapPin, CheckCircle2, FileText, Camera, ImageIcon, Search, RotateCcw, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import toast from 'react-hot-toast';
import { EXECUTIVE_COMMITTEE_SYNTHETIC_ID } from '@/lib/user-approval';

export default function PastEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [canRestoreToActive, setCanRestoreToActive] = useState(false);
    const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
    const [restoring, setRestoring] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => { loadEvents(); }, []);

    async function loadEvents() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin, is_faculty, executive_role, committee_members(committee_id)')
            .eq('id', user.id)
            .maybeSingle();

        const roleStr = profile?.executive_role != null ? String(profile.executive_role).trim() : '';
        const onEcRoster = Array.isArray((profile as any)?.committee_members)
            && (profile as any).committee_members.some(
                (m: { committee_id?: string }) => m.committee_id === EXECUTIVE_COMMITTEE_SYNTHETIC_ID,
            );
        setCanRestoreToActive(
            Boolean(profile?.is_admin || profile?.is_faculty || (roleStr !== '') || onEcRoster),
        );

        const { data } = await supabase
            .from('events')
            .select('*, committees(name)')
            .eq('status', 'completed')
            .order('event_date', { ascending: false });

        setEvents(data || []);
        setLoading(false);
    }

    async function confirmRestoreToActive() {
        if (!restoreTarget?.id) return;
        setRestoring(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .update({ status: 'active' })
                .eq('id', restoreTarget.id)
                .eq('status', 'completed')
                .select('id')
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                toast.error('Could not restore — event may have been changed by someone else.');
                return;
            }
            setEvents((prev) => prev.filter((e) => e.id !== restoreTarget.id));
            toast.success('Event restored to Active. It will show in upcoming and proposals again.');
            setRestoreTarget(null);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to restore event';
            toast.error(msg);
        } finally {
            setRestoring(false);
        }
    }

    const filtered = search
        ? events.filter(e =>
            e.title?.toLowerCase().includes(search.toLowerCase()) ||
            e.committees?.name?.toLowerCase().includes(search.toLowerCase())
        )
        : events;

    if (loading) return <PortalLoadingScreen message="Loading…" />;

    return (
        <div className="min-h-screen bg-mesh">
            <PageHeader title="Past Events" />
            {restoreTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="glass-strong rounded-2xl max-w-md w-full p-6 border border-white/10 shadow-xl">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Restore to active?</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium text-gray-800">{restoreTarget.title}</span>
                                    {' '}will leave Past Events and appear as an active event again (dashboard, public listing if the date is still eligible).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !restoring && setRestoreTarget(null)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                            Use this if the event was marked completed by mistake or needs further edits and visibility.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                disabled={restoring}
                                onClick={() => setRestoreTarget(null)}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={restoring}
                                onClick={() => void confirmRestoreToActive()}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                            >
                                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                Restore to active
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                                className="glass-strong rounded-2xl overflow-hidden border border-transparent hover:border-emerald-200 hover:shadow-xl transition-all duration-300 flex flex-col"
                            >
                                <Link
                                    href={`/dashboard/event-detail/${event.id}`}
                                    className="group block flex-1"
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
                                {canRestoreToActive && (
                                    <div className="px-5 pb-4 pt-0 border-t border-gray-100/80">
                                        <button
                                            type="button"
                                            onClick={() => setRestoreTarget(event)}
                                            className="w-full mt-3 flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-xl border border-amber-200/80 bg-amber-50/90 text-amber-900 hover:bg-amber-100 transition-colors"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            Restore to active
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
