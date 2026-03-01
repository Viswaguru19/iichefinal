'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Edit } from 'lucide-react';
import EditUserModal from '@/components/dashboard/EditUserModal';
import UserToggle from '@/components/dashboard/UserToggle';
import CreateAuthButton from '@/components/dashboard/CreateAuthButton';

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  executive_role: string | null;
  approved: boolean;
  committees?: Array<{committee_id: string, position: string}>;
}

interface UserTableProps {
  initialUsers: User[];
  committees: any[];
}

export default function UserTable({ initialUsers, committees }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const supabase = createClient();

  async function refreshUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { data: committeeMemberships } = await supabase
      .from('committee_members')
      .select('user_id, committee_id, position');

    const usersWithCommittees = data?.map(u => ({
      ...u,
      committees: committeeMemberships?.filter(m => m.user_id === u.id).map(m => ({
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
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Username</th>
              <th className="text-left py-3 px-4">Password</th>
              <th className="text-left py-3 px-4">Executive Role</th>
              <th className="text-left py-3 px-4">Committees</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{u.name}</td>
                <td className="py-3 px-4 text-xs">{u.email}</td>
                <td className="py-3 px-4">
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">{u.username || '-'}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono bg-yellow-100 px-2 py-1 rounded text-xs">iichelogin</span>
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
                    <CreateAuthButton userId={u.id} email={u.email} name={u.name} onSuccess={refreshUsers} />
                    <button
                      onClick={() => setEditingUser(u)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <UserToggle userId={u.id} currentStatus={u.approved} onUpdate={refreshUsers} />
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
    </>
  );
}
