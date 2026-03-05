'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, X, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
    created_at: string;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [loading, setLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        loadNotifications();

        // Set up real-time subscription
        const channel = supabase
            .channel('notifications_page')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications'
                },
                () => {
                    loadNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [filter]);

    async function loadNotifications() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push('/login');

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (filter === 'unread') {
            query = query.eq('read', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error loading notifications:', error);
            toast.error('Failed to load notifications');
            return;
        }

        setNotifications(data || []);
    }

    async function markAsRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true, updated_at: new Date().toISOString() })
            .eq('id', notificationId);

        if (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Failed to mark as read');
            return;
        }

        loadNotifications();
    }

    async function markAllAsRead() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .update({ read: true, updated_at: new Date().toISOString() })
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
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) {
            console.error('Error deleting notification:', error);
            toast.error('Failed to delete notification');
            return;
        }

        toast.success('Notification deleted');
        loadNotifications();
    }

    async function deleteAllRead() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id)
                .eq('read', true);

            if (error) throw error;

            toast.success('All read notifications deleted');
            loadNotifications();
        } catch (error: any) {
            toast.error('Failed to delete notifications');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    function handleNotificationClick(notification: Notification) {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            router.push(notification.link);
        }
    }

    function getNotificationIcon(type: string) {
        switch (type) {
            case 'proposal':
                return '📝';
            case 'approval':
                return '✅';
            case 'rejection':
                return '❌';
            case 'chat':
                return '💬';
            case 'task':
                return '📋';
            case 'meeting':
                return '📅';
            default:
                return '🔔';
        }
    }

    function formatDateTime(dateString: string) {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-2xl font-bold text-blue-600">Notifications</h1>
                        <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header Actions */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5 text-blue-600" />
                                <span className="font-semibold text-gray-900">
                                    {notifications.length} Total
                                </span>
                                {unreadCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {unreadCount} Unread
                                    </span>
                                )}
                            </div>

                            {/* Filter */}
                            <div className="flex items-center gap-2 border-l pl-4">
                                <Filter className="w-4 h-4 text-gray-500" />
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
                                    className="text-sm border border-gray-300 rounded-lg px-3 py-1"
                                >
                                    <option value="all">All</option>
                                    <option value="unread">Unread Only</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    disabled={loading}
                                    className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                    Mark All Read
                                </button>
                            )}
                            <button
                                onClick={deleteAllRead}
                                disabled={loading}
                                className="flex items-center gap-2 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                                Delete Read
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-3">
                    {notifications.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-600">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer relative ${!notification.read ? 'border-l-4 border-blue-600' : ''
                                    }`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className="text-3xl flex-shrink-0">
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <h3 className={`text-lg font-semibold text-gray-900 ${!notification.read ? 'font-bold' : ''
                                                }`}>
                                                {notification.title}
                                            </h3>
                                            {!notification.read && (
                                                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full flex-shrink-0">
                                                    NEW
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-700 mb-3">{notification.message}</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-500">
                                                {formatDateTime(notification.created_at)}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {!notification.read && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markAsRead(notification.id);
                                                        }}
                                                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                        Mark Read
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(notification.id);
                                                    }}
                                                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
