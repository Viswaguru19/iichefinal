import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import UserTable from '@/components/dashboard/UserTable';

export default async function UserManagementPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: committees } = await supabase
    .from('committees')
    .select('id, name')
    .order('name');

  const { data: committeeMemberships } = await supabase
    .from('committee_members')
    .select('user_id, committee_id, position');

  const usersWithCommittees = users?.map(u => ({
    ...u,
    committees: committeeMemberships?.filter(m => m.user_id === u.id).map(m => ({
      committee_id: m.committee_id,
      position: m.position
    })) || []
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">User Management</h1>
            <Link href="/dashboard/admin" className="text-gray-600 hover:text-blue-600">← Back</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">All Users & Credentials</h2>
          <UserTable initialUsers={usersWithCommittees} committees={committees || []} />

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Default Password:</strong> All members use password <code className="bg-yellow-200 px-2 py-1 rounded">iichelogin</code>
            </p>
            <p className="text-xs text-yellow-700 mt-2">
              Members can change their password at /dashboard/profile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
