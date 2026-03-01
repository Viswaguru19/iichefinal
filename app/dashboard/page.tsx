import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Users, Calendar, Trophy, DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile error:', profileError);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
          <p className="text-gray-600 mb-4">Please create your profile first.</p>
          <a href="/setup" className="bg-blue-600 text-white px-6 py-2 rounded-lg">
            Go to Setup
          </a>
        </div>
      </div>
    );
  }

  const isStudent = profile.role === 'student';
  const isAdmin = ['super_admin', 'secretary'].includes(profile.role);
  const canManageKickoff = ['super_admin', 'secretary', 'committee_head'].includes(profile.role);
  const isExecutive = profile.executive_role !== null;

  // Get finance summary
  const { data: financeData } = await supabase.rpc('get_finance_summary');
  const finance = financeData?.[0] || { total_income: 0, total_expense: 0, balance: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">IIChE AVVU Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">{profile.name}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {profile.role.replace('_', ' ').toUpperCase()}
              </span>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" className="text-gray-600 hover:text-red-600">
                  <LogOut className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Hi {profile.name.split(' ')[0]}! 👋</h2>
          <p className="text-gray-600 mt-2">Welcome to your dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-md border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-green-800 text-sm font-medium">Total Income</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">₹{Number(finance.total_income || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl shadow-md border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-red-800 text-sm font-medium">Total Expense</h3>
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">₹{Number(finance.total_expense || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-md border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-blue-800 text-sm font-medium">Balance Fund</h3>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">₹{Number(finance.balance || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {!isStudent && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {isAdmin && (
              <Link href="/dashboard/admin" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg p-8 hover:shadow-xl transition">
                <h3 className="text-2xl font-bold mb-2">Admin Panel</h3>
                <p className="text-blue-100">Manage committees, events, and users</p>
              </Link>
            )}
            {canManageKickoff && (
              <Link href="/dashboard/kickoff" className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow-lg p-8 hover:shadow-xl transition">
                <h3 className="text-2xl font-bold mb-2">Kickoff Control</h3>
                <p className="text-green-100">Manage tournament and live scores</p>
              </Link>
            )}
          </div>
        )}

        <div className="mt-8 grid md:grid-cols-4 gap-6">
          <Link href="/committees" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Users className="w-8 h-8 text-blue-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-900">View Committees</h3>
            <p className="text-sm text-gray-600 mt-2">See all committees and members</p>
          </Link>
          <Link href="/events" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Calendar className="w-8 h-8 text-green-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-900">All Events</h3>
            <p className="text-sm text-gray-600 mt-2">Browse and register for events</p>
          </Link>
          <Link href="/kickoff/schedule" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Trophy className="w-8 h-8 text-yellow-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-900">Kickoff Schedule</h3>
            <p className="text-sm text-gray-600 mt-2">View live scores and fixtures</p>
          </Link>
          <Link href="/dashboard/accounts" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <DollarSign className="w-8 h-8 text-purple-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-900">Statement of Accounts</h3>
            <p className="text-sm text-gray-600 mt-2">View finance records</p>
          </Link>
        </div>

        {!isStudent && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Committee Tools</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <Link href="/dashboard/forms" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                <h3 className="text-lg font-bold text-gray-900">Forms</h3>
                <p className="text-sm text-gray-600 mt-2">Create and manage forms</p>
              </Link>
              <Link href="/dashboard/meetings" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                <h3 className="text-lg font-bold text-gray-900">Meetings</h3>
                <p className="text-sm text-gray-600 mt-2">Schedule and track meetings</p>
              </Link>
              {isExecutive && (
                <Link href="/dashboard/events/workflow" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                  <h3 className="text-lg font-bold text-gray-900">Event Approvals</h3>
                  <p className="text-sm text-gray-600 mt-2">Approve event proposals</p>
                </Link>
              )}
              <Link href="/dashboard/events/progress" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                <h3 className="text-lg font-bold text-gray-900">Event Progress</h3>
                <p className="text-sm text-gray-600 mt-2">Track tasks and updates</p>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
