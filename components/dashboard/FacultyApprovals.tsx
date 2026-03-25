'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function FacultyApprovals() {
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    const [stats, setStats] = useState({ pendingEvents: 0, pendingEmails: 0, pendingPosters: 0, pendingFinance: 0 });
    const [taskProgress, setTaskProgress] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        await Promise.all([loadApprovals(), loadStats(), loadTaskProgress()]);
        setLoading(false);
    }

    async function loadApprovals() {
        const { data: events } = await supabase
            .from('events')
            .select('*, committee:committees(name), proposed_by_profile:profiles!events_proposed_by_fkey(name), head_approver:profiles!events_head_approved_by_fkey(name)')
            .eq('status', 'pending_faculty_approval')
            .order('created_at', { ascending: false })
            .limit(5);
        if (!events) { setPendingApprovals([]); return; }
        const withEc = await Promise.all(events.map(async (event) => {
            const { data: ecApprovals } = await supabase
                .from('ec_approvals')
                .select('user_id, approved_at, profiles(name, executive_role)')
                .eq('event_id', event.id).eq('approved', true).order('approved_at', { ascending: true });
            return { ...event, ec_approvals: ecApprovals || [] };
        }));
        setPendingApprovals(withEc);
    }

    async function loadStats() {
        const [e, em, p, f] = await Promise.all([
            supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'pending_faculty_approval'),
            supabase.from('pr_emails').select('*', { count: 'exact', head: true }).eq('status', 'pending_faculty'),
            supabase.from('posters').select('*', { count: 'exact', head: true }).eq('status', 'pending_faculty'),
            supabase.from('finance_transactions').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        ]);
        setStats({ pendingEvents: e.count || 0, pendingEmails: em.count || 0, pendingPosters: p.count || 0, pendingFinance: f.count || 0 });
    }

    async function loadTaskProgress() {
        const { data: committees } = await supabase.from('committees').select('id, name').eq('type', 'regular');
        if (!committees) return;
        const progress = await Promise.all(committees.map(async (c) => {
            const { count: total } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to_committee_id', c.id);
            const { count: completed } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to_committee_id', c.id).eq('status', 'completed');
            return { committee: c.name, total: total || 0, completed: completed || 0, pct: total ? Math.round(((completed || 0) / total) * 100) : 0 };
        }));
        setTaskProgress(progress);
    }

    async function approveEvent(eventId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        try {
            const { approveEventAsFaculty } = await import('@/lib/approval-workflow');
            await approveEventAsFaculty(eventId, user.id, 'faculty_advisor');
            toast.success('Event approved');
            loadData();
        } catch (err: any) { toast.error(err.message || 'Failed to approve'); }
    }

    async function rejectEvent(eventId: string) {
        const reason = prompt('Enter rejection reason:');
        if (!reason?.trim()) { toast.error('Reason is required'); return; }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        try {
            const { rejectEvent: rejectFn } = await import('@/lib/approval-workflow');
            await rejectFn(eventId, user.id, 'faculty_advisor', reason);
            toast.success('Event rejected');
            loadData();
        } catch (err: any) { toast.error(err.message || 'Failed to reject'); }
    }

    if (loading) return null;

    const totalPending = stats.pendingEvents + stats.pendingEmails + stats.pendingPosters + stats.pendingFinance;

    return (
        <div className="space-y-8">
            {/* Faculty Stats */}
            {totalPending > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Events', value: stats.pendingEvents, color: 'from-blue-500 to-indigo-500' },
                        { label: 'Emails', value: stats.pendingEmails, color: 'from-purple-500 to-fuchsia-500' },
                        { label: 'Posters', value: stats.pendingPosters, color: 'from-emerald-500 to-teal-500' },
                        { label: 'Finance', value: stats.pendingFinance, color: 'from-amber-500 to-orange-500' },
                    ].map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}
                            className="glass-strong rounded-2xl p-4 text-center shadow-md">
                            <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                            <p className="text-2xl font-extrabold text-gray-800 mt-1">{s.value}</p>
                            <div className={`h-1 w-12 mx-auto mt-2 rounded-full bg-gradient-to-r ${s.color}`} />
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Pending Faculty Approvals */}
            {pendingApprovals.length > 0 && (
                <div className="glass rounded-2xl p-6 border-l-4 border-orange-500 glow-amber">
                    <h3 className="text-xl font-bold text-gradient-warm mb-4 flex items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-orange-500" />
                        Faculty Approval Required
                        <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-semibold">{pendingApprovals.length} pending</span>
                    </h3>
                    <div className="space-y-4">
                        {pendingApprovals.map(event => (
                            <div key={event.id} className="glass-strong rounded-xl p-5 hover:shadow-lg transition">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 text-lg">{event.title}</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {event.committee?.name} · Proposed by {event.proposed_by_profile?.name}
                                        </p>
                                    </div>
                                    {event.budget && (
                                        <div className="text-right ml-4">
                                            <p className="text-xs text-gray-400">Budget</p>
                                            <p className="text-lg font-bold text-indigo-600">₹{event.budget.toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {event.event_date ? new Date(event.event_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBA'}</span>
                                    <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> Head: {event.head_approver?.name || 'Approved'}</span>
                                </div>
                                {event.ec_approvals?.length > 0 && (
                                    <div className="bg-white/50 rounded-lg p-3 mb-3">
                                        <p className="text-xs font-semibold text-gray-600 mb-1">EC Approvals ({event.ec_approvals.length})</p>
                                        {event.ec_approvals.map((a: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                                <span className="font-medium">{a.profiles?.name}</span>
                                                <span className="text-gray-400">({a.profiles?.executive_role?.replace(/_/g, ' ')})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => approveEvent(event.id)} className="flex-1 btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold">Approve</motion.button>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => rejectEvent(event.id)} className="flex-1 btn-gradient-red px-4 py-2 rounded-xl text-sm font-semibold">Reject</motion.button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Task Progress by Committee */}
            {taskProgress.length > 0 && taskProgress.some(t => t.total > 0) && (
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-gradient mb-4 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-blue-500" />
                        Task Progress by Committee
                    </h3>
                    <div className="space-y-3">
                        {taskProgress.filter(t => t.total > 0).map(item => (
                            <div key={item.committee}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700">{item.committee}</span>
                                    <span className="text-gray-400">{item.completed}/{item.total} ({item.pct}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
