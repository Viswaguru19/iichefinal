'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Edit, Trash2, Camera, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import EditUserModal from '@/components/dashboard/EditUserModal';
import UserToggle from '@/components/dashboard/UserToggle';
import UserProfilePhotoModal from '@/components/admin/UserProfilePhotoModal';
import Image from 'next/image';

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  executive_role: string | null;
  approved: boolean;
  committees?: Array<{ committee_id: string, position: string }>;
}

interface UserTableProps {
  initialUsers: User[];
  committees: any[];
}

export default function UserTable({ initialUsers, committees }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [photoUser, setPhotoUser] = useState<User | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [passwordResult, setPasswordResult] = useState<{
    name: string;
    email: string;
    tempPassword: string;
    emailed: boolean;
    emailError?: string | null;
  } | null>(null);
  const supabase = createClient();

  async function deleteUser(userId: string, userName: string) {
    if (!confirm(`Delete user ${userName}? This removes their login and profile. This cannot be undone.`)) return;

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await refreshUsers();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function issueTempPassword(user: User) {
    if (
      !confirm(
        `Issue a temporary password for ${user.name}? They must change it the next time they sign in.`,
      )
    ) {
      return;
    }
    setResettingUserId(user.id);
    try {
      const res = await fetch('/api/admin/reset-member-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not reset password');
      setPasswordResult({
        name: user.name,
        email: data.email || user.email,
        tempPassword: data.tempPassword,
        emailed: data.emailed === true,
        emailError: data.emailError,
      });
      toast.success('Temporary password created');
    } catch (error: any) {
      toast.error(error.message || 'Could not reset password');
    } finally {
      setResettingUserId(null);
    }
  }

  async function refreshUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: committeeMemberships } = await supabase
      .from('committee_members')
      .select('user_id, committee_id, position');

    const usersWithCommittees = (data as any)?.map((u: any) => ({
      ...u,
      committees: (committeeMemberships as any)?.filter((m: any) => m.user_id === u.id).map((m: any) => ({
        committee_id: m.committee_id,
        position: m.position
      })) || []
    })) || [];

    if (usersWithCommittees) setUsers(usersWithCommittees);
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">Photo</th>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Username</th>
              <th className="text-left py-3 px-4">Executive Role</th>
              <th className="text-left py-3 px-4">Committees</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <button
                    onClick={() => setPhotoUser(u)}
                    className="relative group"
                    title="Click to change photo"
                  >
                    {(u as any).profile_photo ? (
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-blue-500">
                        <Image
                          src={(u as any).profile_photo}
                          alt={u.name}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Camera className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                      </div>
                    )}
                  </button>
                </td>
                <td className="py-3 px-4">{u.name}</td>
                <td className="py-3 px-4 text-xs">{u.email}</td>
                <td className="py-3 px-4">
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">{u.username || '-'}</span>
                </td>
                <td className="py-3 px-4">
                  {u.executive_role ? (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                      {u.executive_role.replace(/_/g, ' ')}
                    </span>
                  ) : '-'}
                </td>
                <td className="py-3 px-4">
                  <div className="space-y-1">
                    {u.committees?.map((c: any, i: number) => (
                      <div key={i} className="text-xs">
                        {committees.find(com => com.id === c.committee_id)?.name} ({c.position})
                      </div>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${u.approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {u.approved ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Edit user"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void issueTempPassword(u)}
                      disabled={resettingUserId === u.id}
                      className="text-amber-600 hover:text-amber-800 disabled:opacity-40"
                      title="Temporary password"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <UserToggle userId={u.id} currentStatus={u.approved} onUpdate={refreshUsers} />
                    <button
                      onClick={() => deleteUser(u.id, u.name)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          committees={committees}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            refreshUsers();
          }}
        />
      )}

      {photoUser && (
        <UserProfilePhotoModal
          user={photoUser}
          onClose={() => setPhotoUser(null)}
          onSuccess={() => {
            setPhotoUser(null);
            refreshUsers();
          }}
        />
      )}

      {passwordResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Temporary password</h2>
            <p className="text-sm text-gray-600 mb-4">
              Share this with {passwordResult.name}. They must change it as soon as they sign in.
            </p>
            <p className="text-xs text-gray-500 mb-1">{passwordResult.email}</p>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 text-sm bg-white/80 border rounded-lg px-3 py-2 break-all">
                {passwordResult.tempPassword}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(passwordResult.tempPassword);
                  toast.success('Copied');
                }}
                className="text-sm font-semibold text-indigo-700"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {passwordResult.emailed
                ? 'An email with this password was also sent.'
                : `Email was not sent${passwordResult.emailError ? `: ${passwordResult.emailError}` : ''}. Copy and share it yourself.`}
            </p>
            <button
              type="button"
              onClick={() => setPasswordResult(null)}
              className="w-full btn-gradient-blue py-2 rounded-xl font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
