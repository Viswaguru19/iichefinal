import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Crown, Send, ClipboardList } from 'lucide-react';
import DashboardNav from '@/components/dashboard/DashboardNav';
import AnimatedDashboardCard from '@/components/dashboard/AnimatedDashboardCard';
import AnimatedEventProgress from '@/components/dashboard/AnimatedEventProgress';
import AnimatedSection from '@/components/dashboard/AnimatedSection';
import AnimatedCommitteeCard from '@/components/dashboard/AnimatedCommitteeCard';
import AnimatedUpcomingEvents from '@/components/dashboard/AnimatedUpcomingEvents';
import FacultyApprovals from '@/components/dashboard/FacultyApprovals';

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
    await supabase.auth.signOut();
    redirect('/');
  }

  const isStudent = (profile as any).role === 'student';
  const isAdmin = ['super_admin', 'secretary'].includes((profile as any).role) || (profile as any).is_admin || (profile as any).is_faculty;
  const isExecutive = (profile as any).executive_role !== null;
  const isFaculty = (profile as any).is_faculty === true;

  // Get user's committee membership
  const { data: userCommittee } = await supabase
    .from('committee_members')
    .select('committee_id, position, committees(name)')
    .eq('user_id', user.id)
    .neq('committee_id', '00000000-0000-0000-0000-000000000001')
    .single();

  const committeeRole = userCommittee ? `${(userCommittee as any).committees.name} ${(userCommittee as any).position === 'head' ? 'Head' : (userCommittee as any).position === 'co_head' ? 'Co-Head' : 'Member'}` : null;

  // Check if user can manage kickoff (admin OR Social & Environmental Committee head/co-head)
  const canManageKickoff = isAdmin || (
    userCommittee &&
    (userCommittee as any).committees?.name === 'Social and Environmental Committee' &&
    ((userCommittee as any).position === 'head' || (userCommittee as any).position === 'co_head')
  );

  // Get committees
  const { data: committees } = await supabase
    .from('committees')
    .select('*')
    .eq('type', 'regular')
    .order('name');

  // Get executive committee members
  const { data: executiveMembers } = await supabase
    .from('committee_members')
    .select('*, profile:profiles(name, email)')
    .eq('committee_id', '00000000-0000-0000-0000-000000000001')
    .order('position');

  // Get events that have been faculty-approved (active/in_progress/completed) for progress display
  const { data: eventProposals } = await supabase
    .from('events')
    .select('*, committees(name)')
    .in('status', ['active', 'in_progress', 'faculty_approved'])
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch tasks for each event
  const eventsWithTasks = await Promise.all(
    (eventProposals || []).map(async (event: any) => {
      const { data: tasks } = await supabase
        .from('task_assignments')
        .select('id, title, status, completed_at, assigned_to_committee, assigned_committee:assigned_to_committee(name)')
        .eq('event_id', event.id)
        .not('status', 'in', '(pending_ec_approval,rejected)');
      return { ...event, tasks: tasks || [] };
    })
  );

  // Get pending tasks for the user's committees
  const { data: userMemberships } = await supabase
    .from('committee_members')
    .select('committee_id')
    .eq('user_id', user.id);

  const userCommitteeIds = userMemberships?.map(m => m.committee_id) || [];

  let pendingTasks: any[] = [];
  if (userCommitteeIds.length > 0) {
    const { data: pTasks } = await supabase
      .from('task_assignments')
      .select('id, title, status, deadline, event:event_id(title), assigned_committee:assigned_to_committee(name)')
      .in('assigned_to_committee', userCommitteeIds)
      .in('status', ['approved', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(10);
    pendingTasks = pTasks || [];
  }

  // Get unread DM count
  const { count: unreadDmCount } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('read', false);

  // Get upcoming events (only active/approved events)
  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'active')
    .gte('date', new Date().toISOString())
    .order('date', { ascending: true })
    .limit(5);

  // Count pending approvals for the user (head approvals + EC approvals + faculty approvals)
  let pendingApprovalCount = 0;

  // Head approvals: events pending head approval for user's committee
  if (userCommittee && ['head', 'co_head'].includes((userCommittee as any).position)) {
    const { count: headCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_head_approval')
      .eq('committee_id', (userCommittee as any).committee_id || '');
    pendingApprovalCount += headCount || 0;
  }

  // EC approvals: events pending EC approval that this user hasn't approved yet
  if (isExecutive) {
    const { data: pendingEcEvents } = await supabase
      .from('events')
      .select('id')
      .eq('status', 'pending_ec_approval');
    if (pendingEcEvents && pendingEcEvents.length > 0) {
      const { data: myApprovals } = await supabase
        .from('ec_approvals')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('approved', true);
      const approvedIds = new Set(myApprovals?.map(a => a.event_id) || []);
      pendingApprovalCount += pendingEcEvents.filter(e => !approvedIds.has(e.id)).length;
    }
  }

  // Faculty approvals
  if (isFaculty) {
    const { count: facultyCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_faculty_approval');
    pendingApprovalCount += facultyCount || 0;
  }

  return (
    <div className="min-h-screen bg-mesh">
      <DashboardNav userName={(profile as any).name} userRole={(profile as any).role} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatedSection delay={0.1}>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gradient">
              Hi {(profile as any).name.split(' ')[0]}! 👋
            </h2>
            {committeeRole && (
              <p className="mt-2 text-base font-medium text-gray-800">
                {committeeRole}
              </p>
            )}
            {isExecutive && (
              <div className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-2 rounded-full shadow-lg shadow-amber-500/20">
                <Crown className="w-5 h-5" />
                <span className="font-bold">
                  IIChE Executive Committee - {(profile as any).executive_role?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            )}
            <p className="text-gray-600 mt-3">Welcome to your dashboard</p>
          </div>
        </AnimatedSection>

        {/* Quick Access: Proposals & Tasks with badges */}
        <AnimatedSection delay={0.15}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Proposals Card */}
            <Link href="/dashboard/proposals">
              <div className="glass-strong rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer group border border-transparent hover:border-indigo-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Send className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">Proposals</h3>
                      <p className="text-xs text-gray-500">Review & approve events</p>
                    </div>
                  </div>
                  {pendingApprovalCount > 0 && (
                    <span className="min-w-[28px] h-7 flex items-center justify-center bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold rounded-full px-2 shadow-lg shadow-red-500/30 animate-pulse">
                      {pendingApprovalCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Tasks Card */}
            <Link href="/dashboard/tasks">
              <div className="glass-strong rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer group border border-transparent hover:border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <ClipboardList className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">Tasks</h3>
                      <p className="text-xs text-gray-500">Your committee tasks</p>
                    </div>
                  </div>
                  {pendingTasks.length > 0 && (
                    <span className="min-w-[28px] h-7 flex items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-full px-2 shadow-lg shadow-orange-500/30 animate-pulse">
                      {pendingTasks.length}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        </AnimatedSection>

        {/* Event Progress Section */}
        <AnimatedSection delay={0.3}>
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Event Progress</h3>
            <div className="glass rounded-2xl shadow-lg p-6">
              <AnimatedEventProgress events={eventsWithTasks} />
            </div>
          </div>
        </AnimatedSection>

        {!isStudent && (
          <AnimatedSection delay={0.4}>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {isAdmin && (
                <AnimatedDashboardCard
                  href="/dashboard/admin"
                  iconName="Users"
                  title="Admin Panel"
                  description="Manage committees, events, and users"
                  gradient
                  gradientFrom="blue-600"
                  gradientTo="blue-700"
                  index={0}
                />
              )}
              {canManageKickoff && (
                <AnimatedDashboardCard
                  href="/dashboard/kickoff"
                  iconName="Trophy"
                  title="Kickoff Control"
                  description="Manage tournament and live scores"
                  gradient
                  gradientFrom="green-600"
                  gradientTo="green-700"
                  index={1}
                />
              )}
            </div>
          </AnimatedSection>
        )}

        {isFaculty && (
          <AnimatedSection delay={0.45}>
            <div className="mb-8">
              <FacultyApprovals />
            </div>
          </AnimatedSection>
        )}

        <AnimatedSection delay={0.5}>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatedDashboardCard
              href="/dashboard/chat"
              iconName="MessageSquare"
              title="Chats"
              description="Messages & Groups"
              gradient
              gradientFrom="green-600"
              gradientTo="green-700"
              index={0}
              badge={unreadDmCount ?? 0}
            />
            <AnimatedDashboardCard
              href="/dashboard/propose-event"
              iconName="Send"
              title="Propose Event"
              description="Submit event proposal"
              gradient
              gradientFrom="purple-600"
              gradientTo="purple-700"
              index={1}
            />
            <AnimatedDashboardCard
              href="/committees"
              iconName="Users"
              title="View Committees"
              description="See all committees and members"
              iconColor="blue-600"
              index={2}
            />
            <AnimatedDashboardCard
              href="/executive"
              iconName="Crown"
              title="Executive Committee"
              description="View executive members"
              iconColor="yellow-600"
              index={3}
            />
            <AnimatedDashboardCard
              href="/events"
              iconName="Calendar"
              title="All Events"
              description="Browse and register for events"
              iconColor="green-600"
              index={4}
            />
            <AnimatedDashboardCard
              href="/kickoff/schedule"
              iconName="Trophy"
              title="Kickoff Schedule"
              description="View live scores and fixtures"
              iconColor="yellow-600"
              index={5}
            />
            <AnimatedDashboardCard
              href="/dashboard/accounts"
              iconName="DollarSign"
              title="Statement of Accounts"
              description="View finance records"
              iconColor="purple-600"
              index={6}
            />
            <AnimatedDashboardCard
              href="/dashboard/documents"
              iconName="Users"
              title="Documents"
              description="Committee documents"
              iconColor="indigo-600"
              index={7}
            />
          </div>
        </AnimatedSection>

        {/* Committees Section */}
        <AnimatedSection delay={0.6}>
          <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Committees</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {committees?.map((committee: any, index: number) => (
                <AnimatedCommitteeCard key={committee.id} committee={committee} index={index} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Upcoming Events Section */}
        <AnimatedSection delay={0.8}>
          <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Events</h3>
            <div className="glass rounded-2xl shadow-lg p-6">
              <AnimatedUpcomingEvents events={upcomingEvents || []} />
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={1.0}>
          <div className="mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Committee Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <AnimatedDashboardCard
                href="/dashboard/forms"
                iconName="Users"
                title="Forms"
                description="Create and manage forms"
                iconColor="blue-600"
                index={0}
              />
              <AnimatedDashboardCard
                href="/dashboard/meetings"
                iconName="Calendar"
                title="Meetings"
                description="Schedule and track meetings"
                iconColor="green-600"
                index={1}
              />
              {(isExecutive || isFaculty) && (
                <AnimatedDashboardCard
                  href="/dashboard/events/workflow"
                  iconName="Send"
                  title="Event Approvals"
                  description="Approve event proposals"
                  iconColor="purple-600"
                  index={2}
                />
              )}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
