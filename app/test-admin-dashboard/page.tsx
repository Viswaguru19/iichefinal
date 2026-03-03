'use client';

import Link from 'next/link';
import { Users, Calendar, Trophy, DollarSign, UserCheck, MessageSquare, FileText, Power, Settings } from 'lucide-react';

export default function TestAdminDashboard() {
    // Sample data
    const committees = [
        { id: 1, name: 'Technical Committee', type: 'regular' },
        { id: 2, name: 'Marketing Committee', type: 'regular' },
        { id: 3, name: 'Finance Committee', type: 'regular' },
    ];

    const events = [
        { id: 1, title: 'Tech Fest 2024', committee: { name: 'Technical Committee' }, approved: true },
        { id: 2, title: 'Workshop on AI', committee: { name: 'Technical Committee' }, approved: false },
        { id: 3, title: 'Marketing Campaign', committee: { name: 'Marketing Committee' }, approved: true },
    ];

    const users = Array(156).fill(null);
    const pendingUsers = Array(8).fill(null);

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-2xl font-bold text-blue-600">Admin Panel</h1>
                        <Link href="/test-admin-dashboard" className="text-gray-600 hover:text-blue-600">← Back to Dashboard</Link>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <StatCard icon={<Users />} title="Total Users" value={users.length} color="blue" />
                    <StatCard icon={<UserCheck />} title="Pending Approvals" value={pendingUsers.length} color="yellow" />
                    <StatCard icon={<FileText />} title="Total Events" value={events.length} color="green" />
                    <StatCard icon={<Users />} title="Committees" value={committees.length} color="purple" />
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <AdminCard href="/test-admin-user-management" icon={<Power />} title="User Management" desc="Activate/Deactivate users" color="red" />
                    <AdminCard href="/test-admin-dashboard" icon={<Users />} title="Add User" desc="Create new user account" color="green" />
                    <AdminCard href="/test-admin-dashboard" icon={<UserCheck />} title="User Approvals" desc="Approve & assign users" color="blue" />
                    <AdminCard href="/test-admin-dashboard" icon={<Users />} title="Edit Committees" desc="Edit committee details" color="purple" />
                    <AdminCard href="/test-admin-dashboard" icon={<Users />} title="Bulk Import" desc="Import multiple users" color="indigo" />
                    <AdminCard href="/test-admin-dashboard" icon={<Users />} title="Hiring Management" desc="Manage job positions" color="yellow" />
                    <AdminCard href="/test-admin-dashboard" icon={<Settings />} title="Workflow Config" desc="Configure approval workflows" color="indigo" />
                    <AdminCard href="/test-admin-dashboard" icon={<Trophy />} title="Kickoff Control" desc="Tournament management" color="green" />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Events</h2>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {events.slice(0, 5).map((event) => (
                                <div key={event.id} className="border-l-4 border-green-500 pl-4 py-2">
                                    <h3 className="font-bold text-gray-900">{event.title}</h3>
                                    <p className="text-sm text-gray-600">{event.committee.name}</p>
                                    <span className={`text-xs px-2 py-1 rounded-full ${event.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {event.approved ? 'Approved' : 'Pending'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Committees ({committees.length})</h2>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {committees.map((committee) => (
                                <div key={committee.id} className="border-l-4 border-blue-500 pl-4 py-2">
                                    <h3 className="font-bold text-gray-900">{committee.name}</h3>
                                    <p className="text-sm text-gray-600">{committee.type}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, title, value, color }: any) {
    const colors: any = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        purple: 'bg-purple-100 text-purple-600',
    };

    return (
        <div className="bg-white rounded-xl shadow-md p-6">
            <div className={`${colors[color]} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>{icon}</div>
            <h3 className="text-gray-600 text-sm mb-1">{title}</h3>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
    );
}

function AdminCard({ href, icon, title, desc, color }: any) {
    const colors: any = {
        blue: 'from-blue-600 to-blue-700',
        green: 'from-green-600 to-green-700',
        purple: 'from-purple-600 to-purple-700',
        yellow: 'from-yellow-600 to-yellow-700',
        indigo: 'from-indigo-600 to-indigo-700',
        red: 'from-red-600 to-red-700',
    };

    return (
        <Link href={href} className={`bg-gradient-to-r ${colors[color]} text-white rounded-xl shadow-lg p-6 hover:shadow-xl transition group`}>
            <div className="mb-4 group-hover:scale-110 transition">{icon}</div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-white/80 text-sm">{desc}</p>
        </Link>
    );
}
