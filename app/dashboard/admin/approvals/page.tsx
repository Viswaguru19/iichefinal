import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ApprovalActions from '@/components/dashboard/ApprovalActions';

export default async function UserApprovalsPage() {
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

  const { data: pendingUsers } = await supabase
    .from('profiles')
    .select('*')
    .eq('approved', false)
    .order('created_at', { ascending: false });

  const { data: committees } = await supabase
    .from('committees')
    .select('*')
    .order('name');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">User Approvals</h1>
            <Link href="/dashboard/admin" className="text-gray-600 hover:text-blue-600">
              ← Back to Admin
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Pending Approvals ({pendingUsers?.length || 0})
          </h2>

          {(!pendingUsers || pendingUsers.length === 0) && (
            <p className="text-gray-500 text-center py-8">No pending approvals</p>
          )}

          <div className="space-y-4">
            {pendingUsers?.map((user) => (
              <ApprovalActions key={user.id} user={user} committees={committees || []} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
