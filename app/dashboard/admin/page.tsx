import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { hasAdminAccess } from '@/lib/permissions';
import { Users, Calendar, Trophy, DollarSign, UserCheck, MessageSquare, FileText, Power, Settings, Image as ImageIcon, ArrowUpCircle } from 'lucide-react';
import TestEmailCard from '@/components/TestEmailCard';
import TestPushNotificationCard from '@/components/TestPushNotificationCard';
import AdminOnlinePresenceControls from '@/components/dashboard/AdminOnlinePresenceControls';
import { adminEventWorkflowLabel, adminEventStatusBadgeClass } from '@/lib/admin-event-status';
import GradientMesh from '@/components/react-bits/GradientMesh';
import GradientText from '@/components/react-bits/GradientText';
import GsapText from '@/components/react-bits/GsapText';

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !(profile as any).role || (!hasAdminAccess((profile as any).role) && !(profile as any).is_faculty)) {
    redirect('/dashboard');
  }

  const { data: committees } = await supabase.from('committees').select('*').order('name');
  const { data: events } = await supabase.from('events').select('*, committee:committees(name)').order('created_at', { ascending: false });
  const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  const { data: pendingUsers } = await supabase.from('profiles').select('*').eq('approved', false);

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <GradientMesh className="opacity-50" />
      <nav className="premium-panel shadow-lg shadow-indigo-500/5 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-3">
            <h1 className="text-2xl font-bold">
              <GradientText
                className="!mx-0 text-2xl font-bold"
                colors={['#0f766e', '#2563eb', '#0891b2', '#0f766e']}
                animationSpeed={8}
              >
                Admin Panel
              </GradientText>
            </h1>
            <div className="flex items-center gap-3 shrink-0">
              <AdminOnlinePresenceControls />
              <Link href="/dashboard" className="text-gray-500 hover:text-indigo-600 transition whitespace-nowrap">← Back to Dashboard</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <GsapText
          text="Manage users, events, committees, and portal settings."
          as="p"
          className="text-sm text-gray-500 mb-6"
          split="words"
          delay={0.1}
          stagger={0.03}
        />
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <StatCard icon={<Users />} title="Total Users" value={(users as any)?.length || 0} color="blue" />
          <StatCard icon={<UserCheck />} title="Pending user sign-ups" value={(pendingUsers as any)?.length || 0} color="yellow" />
          <StatCard icon={<FileText />} title="Total Events" value={(events as any)?.length || 0} color="green" />
          <StatCard icon={<Users />} title="Committees" value={(committees as any)?.length || 0} color="purple" />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <AdminCard href="/dashboard/admin/users" icon={<Power />} title="User Management" desc="Activate/Deactivate users" color="red" />
          <AdminCard href="/dashboard/member-profiles" icon={<ImageIcon />} title="Member profiles" desc="Add photos and bios for other members" color="teal" />
          <AdminCard href="/dashboard/admin/add-user" icon={<Users />} title="Add User" desc="Create new user account" color="green" />
          <AdminCard href="/dashboard/admin/approvals" icon={<UserCheck />} title="User Approvals" desc="Approve & assign users" color="blue" />
          <AdminCard href="/dashboard/admin/committees" icon={<Users />} title="Edit Committees" desc="Edit committee details" color="purple" />
          <AdminCard href="/dashboard/admin/bulk-import" icon={<Users />} title="Bulk Import" desc="Import multiple users" color="indigo" />
          <AdminCard href="/dashboard/hiring" icon={<Users />} title="Hiring Management" desc="Co-head recruitment & applications" color="yellow" />
          <AdminCard href="/dashboard/admin/cohead-year-transition" icon={<ArrowUpCircle />} title="Co-head → Head (yearly)" desc="Promote co-heads; reverse for tests" color="emerald" />
          <AdminCard href="/dashboard/admin/logo" icon={<ImageIcon />} title="Logo Management" desc="Upload and manage portal logo" color="pink" />
          <AdminCard href="/dashboard/admin/slideshow" icon={<ImageIcon />} title="Slideshow" desc="Manage homepage slideshow" color="teal" />
          <AdminCard href="/dashboard/admin/events" icon={<Calendar />} title="All Events" desc="View, edit, and delete all events" color="orange" />
          <AdminCard href="/dashboard/proposals" icon={<FileText />} title="All Proposals" desc="View and manage all proposals" color="cyan" />
          <AdminCard href="/dashboard/workflow-config" icon={<Settings />} title="Workflow Config" desc="Configure approval workflows" color="indigo" />
          <AdminCard href="/dashboard/kickoff" icon={<Trophy />} title="Kickoff Control" desc="Tournament management" color="green" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <TestEmailCard />
          <TestPushNotificationCard />
          <div className="premium-panel rounded-2xl p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-gradient mb-4">Recent Events</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(events as any)?.slice(0, 5).map((event: any) => (
                <div key={event.id} className="border-l-4 border-green-500 pl-4 py-2">
                  <h3 className="font-bold text-gray-900">{event.title}</h3>
                  <p className="text-sm text-gray-500">{event.committee?.name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${adminEventStatusBadgeClass(event)}`}>
                    {adminEventWorkflowLabel(event)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gradient mb-4">Committees ({(committees as any)?.length})</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(committees as any)?.map((committee: any) => (
                <div key={committee.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                  <h3 className="font-bold text-gray-900">{committee.name}</h3>
                  <p className="text-sm text-gray-500">{committee.type}</p>
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
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-emerald-500 to-teal-500',
    yellow: 'from-amber-500 to-orange-500',
    purple: 'from-purple-500 to-fuchsia-500',
  };

  return (
    <div className="premium-panel rounded-2xl p-6">
      <div className={`bg-gradient-to-br ${colors[color]} w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white`}>{icon}</div>
      <h3 className="text-gray-500 text-sm mb-1">{title}</h3>
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
    pink: 'from-pink-600 to-pink-700',
    teal: 'from-teal-600 to-teal-700',
    orange: 'from-orange-600 to-orange-700',
    cyan: 'from-cyan-600 to-cyan-700',
    emerald: 'from-emerald-600 to-teal-700',
  };

  return (
    <Link href={href} className={`bg-gradient-to-r ${colors[color]} text-white rounded-2xl shadow-lg p-6 hover:shadow-xl hover:scale-[1.02] transition-all group`}>
      <div className="mb-4 group-hover:scale-110 transition">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-white/80 text-sm">{desc}</p>
    </Link>
  );
}
