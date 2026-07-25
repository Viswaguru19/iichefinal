'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, X, Check, CheckCheck, MessageCircle, FileText, Calendar, ClipboardList, CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getNotificationHref } from '@/lib/notification-href';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    related_id?: string | null;
    read: boolean;
    created_at: string;
}

function typeMeta(type: string) {
    switch (type) {
        case 'proposal':
            return { icon: FileText, tint: 'bg-sky-500/10 text-sky-700', bar: 'bg-sky-500' };
        case 'approval':
            return { icon: CheckCircle2, tint: 'bg-emerald-500/10 text-emerald-700', bar: 'bg-emerald-500' };
        case 'rejection':
            return { icon: XCircle, tint: 'bg-rose-500/10 text-rose-700', bar: 'bg-rose-500' };
        case 'chat':
        case 'message':
            return { icon: MessageCircle, tint: 'bg-teal-500/10 text-teal-700', bar: 'bg-teal-500' };
        case 'task':
            return { icon: ClipboardList, tint: 'bg-amber-500/10 text-amber-700', bar: 'bg-amber-500' };
        case 'meeting':
            return { icon: Calendar, tint: 'bg-indigo-500/10 text-indigo-700', bar: 'bg-indigo-500' };
        default:
            return { icon: Bell, tint: 'bg-slate-500/10 text-slate-600', bar: 'bg-slate-400' };
    }
}

function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        loadNotifications();

        let cancelled = false;
        let channel: ReturnType<typeof supabase.channel> | null = null;

        void (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || cancelled) return;
            const ch = supabase
                .channel(`notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    () => {
                        loadNotifications();
                    },
                )
                .subscribe();
            if (cancelled) {
                supabase.removeChannel(ch);
                return;
            }
            channel = ch;
        })();

        return () => {
            cancelled = true;
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    async function loadNotifications() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error loading notifications:', error);
            return;
        }

        setNotifications(data || []);
        setUnreadCount(data?.filter((n: { read?: boolean | null }) => n.read !== true).length || 0);
    }

    async function markAsRead(notificationId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data, error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId)
            .eq('user_id', user.id)
            .select('id');

        if (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
        if (!data?.length) return false;

        await loadNotifications();
        return true;
    }

    async function markAllAsRead() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);

            if (error) throw error;

            toast.success('All notifications marked as read');
            loadNotifications();
        } catch (error: any) {
            toast.error('Failed to mark all as read');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function deleteNotification(notificationId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error deleting notification:', error);
            toast.error('Failed to delete notification');
            return;
        }

        toast.success('Notification deleted');
        loadNotifications();
    }

    async function handleNotificationClick(notification: Notification) {
        if (notification.read !== true) {
            const ok = await markAsRead(notification.id);
            if (!ok) {
                toast.error('Failed to mark as read');
                return;
            }
        }
        const href = getNotificationHref(notification);
        if (href) {
            router.push(href);
            setShowDropdown(false);
        }
    }

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 bg-rose-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />

                    <div className="absolute right-0 mt-2 w-[min(100vw-1.25rem,22rem)] max-w-[calc(100vw-1rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)] border border-slate-200/80 z-50 max-h-[min(70dvh,32rem)] flex flex-col overflow-hidden">
                        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-gradient-to-b from-slate-50 to-white">
                            <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">Notifications</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
                                </p>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        disabled={loading}
                                        className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-full transition-colors disabled:opacity-50"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowDropdown(false)}
                                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 overscroll-contain">
                            {notifications.length === 0 ? (
                                <div className="px-6 py-12 text-center">
                                    <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Bell className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <p className="text-slate-600 text-sm font-medium">No notifications yet</p>
                                    <p className="text-slate-400 text-xs mt-1">Chat and portal updates will show up here</p>
                                </div>
                            ) : (
                                <ul className="py-1">
                                    {notifications.map((notification) => {
                                        const meta = typeMeta(notification.type);
                                        const Icon = meta.icon;
                                        const unread = notification.read !== true;
                                        return (
                                            <li key={notification.id}>
                                                <div
                                                    className={`relative flex gap-3 px-3.5 py-3 cursor-pointer transition-colors ${
                                                        unread ? 'bg-teal-50/40 hover:bg-teal-50/70' : 'hover:bg-slate-50'
                                                    }`}
                                                    onClick={() => void handleNotificationClick(notification)}
                                                >
                                                    {unread && (
                                                        <span className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r ${meta.bar}`} />
                                                    )}
                                                    <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.tint}`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className={`text-[13px] leading-snug text-slate-900 ${unread ? 'font-semibold' : 'font-medium'}`}>
                                                                {notification.title}
                                                            </p>
                                                            <span className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                                                                {formatTimeAgo(notification.created_at)}
                                                            </span>
                                                        </div>
                                                        <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                            {notification.message}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 flex-shrink-0 self-start">
                                                        {unread && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void markAsRead(notification.id);
                                                                }}
                                                                className="p-1.5 text-teal-600 hover:bg-teal-100 rounded-full"
                                                                title="Mark as read"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNotification(notification.id);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full"
                                                            title="Delete"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-2.5 border-t border-slate-100 bg-slate-50/80">
                                <button
                                    onClick={() => {
                                        router.push('/dashboard/notifications');
                                        setShowDropdown(false);
                                    }}
                                    className="w-full py-2 text-[13px] font-medium text-teal-700 hover:bg-white rounded-xl transition-colors"
                                >
                                    View all notifications
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
