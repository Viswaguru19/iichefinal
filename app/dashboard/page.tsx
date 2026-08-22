import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { Crown, Send, ClipboardList } from 'lucide-react';
import DashboardNav from '@/components/dashboard/DashboardNav';
import AnimatedDashboardCard from '@/components/dashboard/AnimatedDashboardCard';
import AnimatedSection from '@/components/dashboard/AnimatedSection';
import AnimatedCommitteeCard from '@/components/dashboard/AnimatedCommitteeCard';
import AnimatedUpcomingEvents from '@/components/dashboard/AnimatedUpcomingEvents';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import DashboardHero from '@/components/react-bits/DashboardHero';
import GradientMesh from '@/components/react-bits/GradientMesh';

const AnimatedEventProgress = nextDynamic(() => import('@/components/dashboard/AnimatedEventProgress'), {
  loading: () => <div className="h-24 animate-pulse rounded-xl bg-white/40" />,
});

const FacultyApprovals = nextDynamic(() => import('@/components/dashboard/FacultyApprovals'), {
  loading: () => <PortalLoadingScreen fullPage={false} message="Loading approvals…" />,
});

const PastEvents = nextDynamic(() => import('@/components/dashboard/PastEvents'), {
  loading: () => <div className="h-40 animate-pulse rounded-xl bg-white/40" />,
});

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Do not block first paint on chat membership backfill
  void supabase.rpc('ensure_default_chat_memberships').then(({ error }) => {
    if (error) console.warn('ensure_default_chat_memberships:', error.message);
  });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect('/');
  }

  if ((profile as { hiring_portal_only?: boolean }).hiring_portal_only) {
    redirect('/hiring/portal');
  }

  const isStudent = (profile as any).role === 'student';
  const isAdmin = ['super_admin', 'secretary'].includes((profile as any).role) || (profile as any).is_admin || (profile as any).is_faculty;
  const isExecutive = (profile as any).executive_role !== null;
  const isFaculty = (profile as any).is_faculty === true;

  const [
    userCommitteeRes,
    committeesRes,
    executiveMembersRes,
    eventProposalsRes,
    pastEventsRes,
    userMembershipsRes,
    unreadDmCountRes,
  ] = await Promise.all([
    supabase
      .from('committee_members')
      .select('committee_id, position, committees(name)')
      .eq('user_id', user.id)
      .neq('committee_id', '00000000-0000-0000-0000-000000000001')
      .single(),
    supabase.from('committees').select('*').eq('type', 'regular').order('name'),
    supabase
      .from('committee_members')
      .select('*, profile:profiles(name, email)')
      .eq('committee_id', '00000000-0000-0000-0000-000000000001')
      .order('position'),
    supabase
      .from('events')
      .select('*, committees(name)')
      .in('status', ['active', 'in_progress', 'faculty_approved'])
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('events')
      .select('*, committees(name)')
      .eq('status', 'completed')
      .order('event_date', { ascending: false })
      .limit(20),
    supabase.from('committee_members').select('committee_id').eq('user_id', user.id),
    supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .or('read.is.null,read.eq.false'),
  ]);

  const userCommittee = userCommitteeRes.data;
  const committees = committeesRes.data;
  const executiveMembers = executiveMembersRes.data;
  const eventProposals = eventProposalsRes.data;
  const pastEvents = pastEventsRes.data;
  const userMemberships = userMembershipsRes.data;
  const unreadDmCount = unreadDmCountRes.count ?? 0;

  // Skip expensive per-group unread counts on dashboard — DMs only keeps first paint fast
  const chatUnreadBadgeTotal = unreadDmCount;

  const committeeRole = userCommittee ? `${(userCommittee as any).committees.name} ${(userCommittee as any).position === 'head' ? 'Head' : (userCommittee as any).position === 'co_head' ? 'Co-Head' : 'Member'}` : null;

  // Check if user can manage kickoff (admin OR Social & Environmental Committee head/co-head)
  const canManageKickoff = isAdmin || (
    userCommittee &&
    (userCommittee as any).committees?.name === 'Social and Environmental Committee' &&
    ((userCommittee as any).position === 'head' || (userCommittee as any).position === 'co_head')
  );

  const eventIds = (eventProposals || []).map((e: any) => e.id);
  const { data: allTasksForEvents } = eventIds.length > 0
    ? await supabase
      .from('task_assignments')
      .select('id, title, status, completed_at, assigned_to_committee, assigned_committee:assigned_to_committee(name), event_id')
      .in('event_id', eventIds)
      .not('status', 'in', '(pending_ec_approval,rejected)')
    : { data: [] as any[] };

  const tasksByEvent = (allTasksForEvents || []).reduce((acc: Record<string, any[]>, task: any) => {
    if (!acc[task.event_id]) acc[task.event_id] = [];
    acc[task.event_id].push(task);
    return acc;
  }, {});

  const eventsWithTasks = (eventProposals || []).map((event: any) => ({
    ...event,
    tasks: tasksByEvent[event.id] || [],
  }));

  const userCommitteeIds = userMemberships?.map(m => m.committee_id) || [];
  const isHead = userCommittee && ['head', 'co_head'].includes((userCommittee as any).position);
  const committeeIdForHead = (userCommittee as any)?.committee_id || '';

  const [pendingTasksResult, headApprovalRes, ecApprovalBundle, facultyApprovalRes] = await Promise.all([
    userCommitteeIds.length > 0
      ? supabase
          .from('task_assignments')
          .select('id, title, status, deadline, event:event_id(title), assigned_committee:assigned_to_committee(name)')
          .in('assigned_to_committee', userCommitteeIds)
          .in('status', ['approved', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
    isHead
      ? supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_head_approval')
          .eq('committee_id', committeeIdForHead)
      : Promise.resolve({ count: 0 }),
    isExecutive
      ? Promise.all([
          supabase.from('events').select('id').eq('status', 'pending_ec_approval'),
          supabase.from('ec_approvals').select('event_id').eq('user_id', user.id).eq('approved', true),
        ])
      : Promise.resolve([{ data: [] as { id: string }[] }, { data: [] as { event_id: string }[] }] as const),
    isFaculty
      ? supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_faculty_approval')
      : Promise.resolve({ count: 0 }),
  ]);

  const pendingTasks = pendingTasksResult.data || [];

  let pendingApprovalCount = headApprovalRes.count || 0;
  if (isExecutive) {
    const [pendingEcEventsRes, myApprovalsRes] = ecApprovalBundle;
    const pendingEcEvents = pendingEcEventsRes.data || [];
    if (pendingEcEvents.length > 0) {
      const approvedIds = new Set((myApprovalsRes.data || []).map((a) => a.event_id));
      pendingApprovalCount += pendingEcEvents.filter((e) => !approvedIds.has(e.id)).length;
    }
  }
  pendingApprovalCount += facultyApprovalRes.count || 0;

  const profileName = String((profile as any).name ?? '').trim();
  const greetingFirst = profileName.split(/\s+/).filter(Boolean)[0] || 'there';

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <GradientMesh className="opacity-45" />
      <DashboardNav
        userName={profileName || 'Member'}
        userRole={String((profile as any).role ?? 'member')}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 relative z-10">
        <AnimatedSection delay={0.1}>
          <DashboardHero firstName={greetingFirst} roleLine={committeeRole || null}>
            {isExecutive && (
              <div className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-lg shadow-amber-500/20 text-xs sm:text-sm max-w-full">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="font-bold truncate">
                  IIChE Executive Committee - {(profile as any).executive_role?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            )}
          </DashboardHero>
        </AnimatedSection>

        {/* Quick Access: Proposals & Tasks with badges */}
        <AnimatedSection delay={0.15}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {/* Proposals Card */}
            <Link href="/dashboard/proposals">
              <div className="premium-panel rounded-2xl p-4 sm:p-5 hover:shadow-xl transition-all cursor-pointer group border border-transparent hover:border-indigo-200">
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
              <div className="premium-panel rounded-2xl p-4 sm:p-5 hover:shadow-xl transition-all cursor-pointer group border border-transparent hover:border-orange-200">
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
          <div className="mb-6 sm:mb-8">
            <h3 className="text-xl sm:text-2xl font-bold dashboard-section-title mb-3 sm:mb-4">Event Progress</h3>
            <div className="premium-card rounded-2xl shadow-lg p-4 sm:p-6">
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
          <div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <AnimatedDashboardCard
              href="/chat"
              iconName="MessageSquare"
              title="IIChE Chat"
              description="WhatsApp-style messages"
              gradient
              gradientFrom="green-600"
              gradientTo="green-700"
              index={0}
              badge={chatUnreadBadgeTotal}
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
          <div className="mt-6 sm:mt-8">
            <h3 className="text-xl sm:text-2xl font-bold dashboard-section-title mb-3 sm:mb-4">Our Committees</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {committees?.map((committee: any, index: number) => (
                <AnimatedCommitteeCard key={committee.id} committee={committee} index={index} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={1.0}>
          <div className="mt-6 sm:mt-8">
            <h3 className="text-lg sm:text-xl font-bold dashboard-section-title mb-3 sm:mb-4">Committee Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
              <AnimatedDashboardCard
                href="/dashboard/past-events"
                iconName="CheckCircle"
                title="Past Events"
                description="View completed events"
                iconColor="emerald-600"
                index={3}
              />
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
