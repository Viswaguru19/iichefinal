'use client';

import { Users, UserCheck, Building2, Calendar, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function TestAdminUIPage() {
    // Sample data
    const stats = [
        { label: 'Total Users', value: '156', icon: Users, color: 'blue', change: '+12%' },
        { label: 'Pending Approvals', value: '8', icon: UserCheck, color: 'yellow', change: '+3' },
        { label: 'Active Events', value: '12', icon: Calendar, color: 'green', change: '+2' },
        { label: 'Committees', value: '6', icon: Building2, color: 'purple', change: '0' },
    ];

    const pendingUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'student', date: '2024-03-15' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'student', date: '2024-03-14' },
        { id: 3, name: 'Bob Wilson', email: 'bob@example.com', role: 'student', date: '2024-03-13' },
    ];

    const recentActivity = [
        { action: 'User approved', user: 'Alice Johnson', time: '2 hours ago' },
        { action: 'Event created', user: 'Tech Committee', time: '5 hours ago' },
        { action: 'Task completed', user: 'Marketing Team', time: '1 day ago' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">A</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                                <p className="text-xs text-gray-500">IIChE AVVU Portal</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                View All Pages
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {stats.map((stat, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                                    <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                                </div>
                                <span className={`text-sm font-semibold ${stat.change.startsWith('+') ? 'text-green-600' : 'text-gray-600'}`}>
                                    {stat.change}
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                            <p className="text-sm text-gray-600">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Pending Approvals */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Pending Approvals</h2>
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                                {pendingUsers.length} pending
                            </span>
                        </div>
                        <div className="space-y-4">
                            {pendingUsers.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                            <span className="text-white font-semibold text-sm">
                                                {user.name.split(' ').map(n => n[0]).join('')}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{user.name}</p>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                                            Approve
                                        </button>
                                        <button className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm">
                            View All Approvals →
                        </button>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">Recent Activity</h2>
                        <div className="space-y-4">
                            {recentActivity.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                                        <p className="text-sm text-gray-600">{activity.user}</p>
                                        <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <Link
                            href="/test-admin-users"
                            className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition text-center"
                        >
                            <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                            <p className="font-semibold text-gray-900">User Management</p>
                            <p className="text-xs text-gray-500 mt-1">Manage all users</p>
                        </Link>
                        <Link
                            href="/test-admin-approvals"
                            className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition text-center"
                        >
                            <UserCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
                            <p className="font-semibold text-gray-900">Approvals</p>
                            <p className="text-xs text-gray-500 mt-1">Review pending requests</p>
                        </Link>
                        <Link
                            href="/test-admin-committees"
                            className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition text-center"
                        >
                            <Building2 className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                            <p className="font-semibold text-gray-900">Committees</p>
                            <p className="text-xs text-gray-500 mt-1">Manage committees</p>
                        </Link>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        📋 Admin Dashboard Preview
                    </h3>
                    <p className="text-blue-800 mb-4">
                        This is a preview of the admin dashboard UI. The actual dashboard requires login and proper permissions.
                    </p>
                    <div className="space-y-2 text-sm text-blue-700">
                        <p>• <strong>Stats Cards</strong>: Show key metrics at a glance</p>
                        <p>• <strong>Pending Approvals</strong>: Quick approve/reject actions</p>
                        <p>• <strong>Recent Activity</strong>: Timeline of recent events</p>
                        <p>• <strong>Quick Actions</strong>: Navigate to main admin pages</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
