'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    Users,
    Search,
    Edit,
    Key,
    Mail,
    CheckCircle,
    XCircle,
} from 'lucide-react';

export default function TestUserManagementPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    // Sample users data
    const users = [
        {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'student',
            executive_role: null,
            is_active: true,
            committee_members: [
                { committee: { name: 'Technical Committee' }, position: 'member' }
            ]
        },
        {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            role: 'secretary',
            executive_role: 'secretary',
            is_active: true,
            committee_members: []
        },
        {
            id: 3,
            name: 'Dr. Kumar',
            email: 'kumar@example.com',
            role: 'faculty_advisor',
            executive_role: null,
            is_active: true,
            committee_members: []
        },
        {
            id: 4,
            name: 'Bob Wilson',
            email: 'bob@example.com',
            role: 'committee_head',
            executive_role: null,
            is_active: false,
            committee_members: [
                { committee: { name: 'Marketing Committee' }, position: 'head' }
            ]
        },
        {
            id: 5,
            name: 'Alice Johnson',
            email: 'alice@example.com',
            role: 'treasurer',
            executive_role: 'treasurer',
            is_active: true,
            committee_members: []
        },
    ];

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && user.is_active) ||
            (statusFilter === 'inactive' && !user.is_active);
        return matchesSearch && matchesRole && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Users className="w-8 h-8 text-blue-600" />
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                                <p className="text-gray-600 mt-1">{filteredUsers.length} users</p>
                            </div>
                        </div>
                        <Link
                            href="/test-admin-dashboard"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Back to Admin
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Role Filter */}
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="faculty_advisor">Faculty Advisor</option>
                            <option value="secretary">Secretary</option>
                            <option value="treasurer">Treasurer</option>
                            <option value="committee_head">Committee Head</option>
                            <option value="committee_cohead">Committee Co-Head</option>
                            <option value="committee_member">Committee Member</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Committees
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                        <span className="text-blue-600 font-semibold">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {user.role.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                            </div>
                                            {user.executive_role && (
                                                <div className="text-xs text-blue-600">
                                                    EC: {user.executive_role.replace(/_/g, ' ')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900">
                                                {user.committee_members?.map((cm: any, idx: number) => (
                                                    <div key={idx} className="mb-1">
                                                        {cm.committee.name}
                                                        <span className="text-xs text-gray-500 ml-1">({cm.position})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.is_active ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowEditModal(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="Edit Role"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                <button
                                                    className="text-yellow-600 hover:text-yellow-900"
                                                    title="Reset Password"
                                                >
                                                    <Key className="w-5 h-5" />
                                                </button>
                                                <button
                                                    className="text-purple-600 hover:text-purple-900"
                                                    title="Change Email"
                                                >
                                                    <Mail className="w-5 h-5" />
                                                </button>
                                                <button
                                                    className={user.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                                                    title={user.is_active ? 'Deactivate' : 'Activate'}
                                                >
                                                    {user.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit Role Modal */}
            {showEditModal && selectedUser && (
                <EditRoleModal
                    user={selectedUser}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedUser(null);
                    }}
                />
            )}
        </div>
    );
}

function EditRoleModal({ user, onClose }: any) {
    const [role, setRole] = useState(user.role);
    const [executiveRole, setExecutiveRole] = useState(user.executive_role);

    const roles = [
        'admin',
        'faculty_advisor',
        'secretary',
        'joint_secretary',
        'associate_secretary',
        'associate_joint_secretary',
        'treasurer',
        'associate_treasurer',
        'committee_head',
        'committee_cohead',
        'committee_member',
    ];

    const executiveRoles = [
        'secretary',
        'joint_secretary',
        'associate_secretary',
        'associate_joint_secretary',
        'treasurer',
        'associate_treasurer',
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit User Role</h2>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">User: {user.name}</p>
                    <p className="text-sm text-gray-600 mb-4">Email: {user.email}</p>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        {roles.map((r) => (
                            <option key={r} value={r}>
                                {r.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Executive Role (Optional)
                    </label>
                    <select
                        value={executiveRole || ''}
                        onChange={(e) => setExecutiveRole(e.target.value || null)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">None</option>
                        {executiveRoles.map((r) => (
                            <option key={r} value={r}>
                                {r.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Save Changes
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
