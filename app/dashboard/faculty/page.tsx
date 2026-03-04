'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
    DollarSign,
    Calendar,
    CheckCircle,
    TrendingUp,
    FileText,
    Mail,
    Image as ImageIcon,
    AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyDashboard() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({
        pendingEvents: 0,
        pendingTasks: 0,
        pendingEmails: 0,
        pendingPosters: 0,
        pendingFinance: 0,
        totalBudget: 0,
        upcomingEvents: 0,
    });
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    const [financeOverview, setFinanceOverview] = useState<any>(null);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [taskProgress, setTaskProgress] = useState<any[]>([]);

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        checkAccess();
    }, []);

    async function checkAccess() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push('/login');

        const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!userProfile?.is_faculty) {
            toast.error('Access denied: Faculty only');
            return router.push('/dashboard');
        }

        setProfile(userProfile);
        await loadDashboardData();
        setLoading(false);
    }

    async function loadDashboardData() {
        await Promise.all([
            loadStats(),
            loadPendingApprovals(),
            loadFinanceOverview(),
            loadUpcomingEvents(),
            loadTaskProgress(),
        ]);
    }

    async function loadStats() {
        // Pending events
        const { count: pendingEvents } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_faculty_approval');

        // Pending tasks (EC approved, waiting for faculty review)
        const { count: pendingTasks } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_ec_approval');

        // Pending PR emails
        const { count: pendingEmails } = await supabase
            .from('pr_emails')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_faculty');

        // Pending posters
        const { count: pendingPosters } = await supabase
            .from('posters')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_faculty');

        // Pending finance
        const { count: pendingFinance } = await supabase
            .from('finance_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');

        // Total budget
        const { data: budgetData } = await supabase
            .from('events')
            .select('budget')
            .eq('status', 'active');

        const totalBudget = budgetData?.reduce((sum, e) => sum + (e.budget || 0), 0) || 0;

        // Upcoming events
        const { count: upcomingEvents } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('event_date', new Date().toISOString());

        setStats({
            pendingEvents: pendingEvents || 0,
            pendingTasks: pendingTasks || 0,
            pendingEmails: pendingEmails || 0,
            pendingPosters: pendingPosters || 0,
            pendingFinance: pendingFinance || 0,
            totalBudget,
            upcomingEvents: upcomingEvents || 0,
        });
    }

    async function loadPendingApprovals() {
        const { data: events } = await supabase
            .from('events')
            .select(`
                *,
                committee:committees(name),
                proposed_by_profile:profiles!events_proposed_by_fkey(name),
                head_approver:profiles!events_head_approved_by_fkey(name)
            `)
            .eq('status', 'pending_faculty_approval')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!events) {
            setPendingApprovals([]);
            return;
        }

        // Fetch EC approvals for each event
        const eventsWithApprovals = await Promise.all(
            events.map(async (event) => {
                const { data: ecApprovals } = await supabase
                    .from('ec_approvals')
                    .select('user_id, approved_at, profiles(name, executive_role)')
                    .eq('event_id', event.id)
                    .eq('approved', true)
                    .order('approved_at', { ascending: true });

                return {
                    ...event,
                    ec_approvals: ecApprovals || [],
                };
            })
        );

        setPendingApprovals(eventsWithApprovals);
    }

    async function loadFinanceOverview() {
        const { data: transactions } = await supabase
            .from('finance_transactions')
            .select('transaction_type, amount, approval_status')
            .order('created_at', { ascending: false });

        const overview = {
            totalIncome: 0,
            totalExpense: 0,
            pendingAmount: 0,
        };

        transactions?.forEach((t) => {
            if (t.approval_status === 'approved') {
                if (t.transaction_type === 'income') {
                    overview.totalIncome += t.amount;
                } else if (t.transaction_type === 'expense') {
                    overview.totalExpense += t.amount;
                }
            } else if (t.approval_status === 'pending') {
                overview.pendingAmount += t.amount;
            }
        });

        setFinanceOverview(overview);
    }

    async function loadUpcomingEvents() {
        const { data } = await supabase
            .from('events')
            .select('*, committee:committees(name)')
            .eq('status', 'active')
            .gte('event_date', new Date().toISOString())
            .order('event_date', { ascending: true })
            .limit(5);

        setUpcomingEvents(data || []);
    }

    async function loadTaskProgress() {
        const { data: committees } = await supabase
            .from('committees')
            .select('id, name')
            .eq('type', 'regular');

        if (!committees) return;

        const progress = await Promise.all(
            committees.map(async (committee) => {
                const { count: total } = await supabase
                    .from('tasks')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_to_committee_id', committee.id);

                const { count: completed } = await supabase
                    .from('tasks')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_to_committee_id', committee.id)
                    .eq('status', 'completed');

                return {
                    committee: committee.name,
                    total: total || 0,
                    completed: completed || 0,
                    percentage: total ? Math.round(((completed || 0) / total) * 100) : 0,
                };
            })
        );

        setTaskProgress(progress);
    }

    async function approveEvent(eventId: string) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Import and use the approval workflow function
            const { approveEventAsFaculty } = await import('@/lib/approval-workflow');

            await approveEventAsFaculty(eventId, user.id, 'faculty_advisor');

            toast.success('Event approved and activated successfully');
            await loadDashboardData();
        } catch (error: any) {
            console.error('Approval error:', error);
            toast.error(error.message || 'Failed to approve event');
        }
    }

    async function rejectEvent(eventId: string) {
        const reason = prompt('Enter rejection reason (required):');

        // Validate rejection reason is non-empty
        if (!reason || reason.trim().length === 0) {
            toast.error('Rejection reason is required');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Import and use the approval workflow function
            const { rejectEvent: rejectEventWorkflow } = await import('@/lib/approval-workflow');

            await rejectEventWorkflow(eventId, user.id, 'faculty_advisor', reason);

            toast.success('Event rejected');
            await loadDashboardData();
        } catch (error: any) {
            console.error('Rejection error:', error);
            toast.error(error.message || 'Failed to reject event');
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading Faculty Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Faculty Dashboard</h1>
                            <p className="text-gray-600 mt-1">Welcome, {profile?.name}</p>
                        </div>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Pending Approvals Section - Prominently at Top */}
                {pendingApprovals.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-l-4 border-orange-500">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-7 h-7 text-orange-600" />
                            Pending Event Approvals
                            <span className="ml-auto text-sm font-normal bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                                {pendingApprovals.length} pending
                            </span>
                        </h2>
                        <div className="space-y-4">
                            {pendingApprovals.map((event) => (
                                <div key={event.id} className="border rounded-lg p-5 hover:shadow-md transition bg-gray-50">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 text-lg">{event.title}</h3>
                                            <p className="text-sm text-gray-600 mt-1">
                                                <span className="font-medium">{event.committee?.name}</span>
                                                {' • '}
                                                Proposed by {event.proposed_by_profile?.name}
                                            </p>
                                        </div>
                                        {event.budget && (
                                            <div className="text-right ml-4">
                                                <p className="text-xs text-gray-500">Budget</p>
                                                <p className="text-lg font-bold text-blue-600">
                                                    ₹{event.budget.toLocaleString()}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Calendar className="w-4 h-4" />
                                            <span>
                                                {event.event_date
                                                    ? new Date(event.event_date).toLocaleDateString('en-IN', {
                                                        weekday: 'short',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })
                                                    : 'TBA'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <span>Head: {event.head_approver?.name || 'Approved'}</span>
                                        </div>
                                    </div>

                                    {/* EC Approval History */}
                                    <div className="bg-white rounded-lg p-3 mb-3">
                                        <p className="text-xs font-semibold text-gray-700 mb-2">
                                            EC Approvals ({event.ec_approvals?.length || 0}/2 required)
                                        </p>
                                        {event.ec_approvals && event.ec_approvals.length > 0 ? (
                                            <div className="space-y-1">
                                                {event.ec_approvals.map((approval: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                                                        <CheckCircle className="w-3 h-3 text-green-600" />
                                                        <span className="font-medium">{approval.profiles?.name}</span>
                                                        <span className="text-gray-400">
                                                            ({approval.profiles?.executive_role?.replace(/_/g, ' ')})
                                                        </span>
                                                        <span className="text-gray-400 ml-auto">
                                                            {new Date(approval.approved_at).toLocaleDateString('en-IN', {
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500">No EC approvals yet</p>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => approveEvent(event.id)}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => rejectEvent(event.id)}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Pending Events"
                        value={stats.pendingEvents}
                        icon={<Calendar className="w-6 h-6" />}
                        color="blue"
                        onClick={() => router.push('/dashboard/faculty/approvals?type=events')}
                    />
                    <StatCard
                        title="Pending Emails"
                        value={stats.pendingEmails}
                        icon={<Mail className="w-6 h-6" />}
                        color="purple"
                        onClick={() => router.push('/dashboard/faculty/approvals?type=emails')}
                    />
                    <StatCard
                        title="Pending Posters"
                        value={stats.pendingPosters}
                        icon={<ImageIcon className="w-6 h-6" />}
                        color="green"
                        onClick={() => router.push('/dashboard/faculty/approvals?type=posters')}
                    />
                    <StatCard
                        title="Pending Finance"
                        value={stats.pendingFinance}
                        icon={<DollarSign className="w-6 h-6" />}
                        color="yellow"
                        onClick={() => router.push('/dashboard/faculty/finance')}
                    />
                </div>

                {/* Finance Overview */}
                {financeOverview && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <DollarSign className="w-6 h-6 text-green-600" />
                            Finance Overview
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <p className="text-sm text-gray-600">Total Income</p>
                                <p className="text-2xl font-bold text-green-600">
                                    ₹{financeOverview.totalIncome.toLocaleString()}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600">Total Expense</p>
                                <p className="text-2xl font-bold text-red-600">
                                    ₹{financeOverview.totalExpense.toLocaleString()}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600">Balance</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    ₹{(financeOverview.totalIncome - financeOverview.totalExpense).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                    {/* Task Progress */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-blue-600" />
                            Task Progress by Committee
                        </h2>
                        <div className="space-y-4">
                            {taskProgress.map((item) => (
                                <div key={item.committee}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-700">{item.committee}</span>
                                        <span className="text-gray-600">
                                            {item.completed}/{item.total} ({item.percentage}%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                            style={{ width: `${item.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-purple-600" />
                        Upcoming Events
                    </h2>
                    {upcomingEvents.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No upcoming events</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingEvents.map((event) => (
                                <div key={event.id} className="border rounded-lg p-4 hover:shadow-md transition">
                                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                                    <p className="text-sm text-gray-600 mt-1">{event.committee?.name}</p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        {new Date(event.event_date).toLocaleDateString('en-IN', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <QuickAction
                        title="View All Approvals"
                        icon={<CheckCircle className="w-8 h-8" />}
                        onClick={() => router.push('/dashboard/faculty/approvals')}
                    />
                    <QuickAction
                        title="Finance Management"
                        icon={<DollarSign className="w-8 h-8" />}
                        onClick={() => router.push('/dashboard/faculty/finance')}
                    />
                    <QuickAction
                        title="View Documents"
                        icon={<FileText className="w-8 h-8" />}
                        onClick={() => router.push('/dashboard/documents')}
                    />
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, onClick }: any) {
    const colors = {
        blue: 'bg-blue-100 text-blue-600',
        purple: 'bg-purple-100 text-purple-600',
        green: 'bg-green-100 text-green-600',
        yellow: 'bg-yellow-100 text-yellow-600',
    };

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                </div>
                <div className={`p-3 rounded-lg ${colors[color as keyof typeof colors]}`}>{icon}</div>
            </div>
        </div>
    );
}

function QuickAction({ title, icon, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition text-center"
        >
            <div className="flex justify-center text-blue-600 mb-3">{icon}</div>
            <p className="font-semibold text-gray-900">{title}</p>
        </button>
    );
}
