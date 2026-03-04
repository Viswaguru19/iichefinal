import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Crown } from 'lucide-react';
import DynamicLogo from '@/components/DynamicLogo';
import AnimatedDashboardCard from '@/components/dashboard/AnimatedDashboardCard';
import AnimatedEventProgress from '@/components/dashboard/AnimatedEventProgress';
import AnimatedPendingApprovals from '@/components/dashboard/AnimatedPendingApprovals';
import AnimatedSection from '@/components/dashboard/AnimatedSection';
import AnimatedCommitteeCard from '@/components/dashboard/AnimatedCommitteeCard';
import AnimatedUpcomingEvents from '@/components/dashboard/AnimatedUpcomingEvents';

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
  const isAdmin = ['super_admin', 'secretary'].includes((profile as any).role);
  const canManageKickoff = ['super_admin', 'secretary', 'committee_head'].includes((profile as any).role);
  const isExecutive = (profile as any).executive_role !== null;
  const isFaculty = (profile as any).is_faculty === true;

  // Get user's committee membership
  const { data: userCommittee } = await supabase
    .from('committee_members')
    .select('position, committees(name)')
    .eq('user_id', user.id)
    .neq('committee_id', '00000000-0000-0000-0000-000000000001')
    .single();

  const committeeRole = userCommittee ? `${(userCommittee as any).committees.name} ${(userCommittee as any).position === 'head' ? 'Head' : (userCommittee as any).position === 'co_head' ? 'Co-Head' : 'Member'}` : null;

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

  // Get upcoming events with progress
  const { data: eventProposals } = await supabase
    .from('event_proposals')
    .select('*, committees(name)')
    .in('status', ['pending_head', 'pending_executive', 'approved', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(10);

  // Get upcoming events
  const { data: upcomingEvents } = await supabase
    .from('event_proposals')
    .select('*')
    .eq('status', 'approved')
    .gte('date', new Date().toISOString())
    .order('date', { ascending: true })
    .limit(5);

  // Get pending head approvals
  const { data: pendingHeadApprovals } = await supabase
    .from('event_proposals')
    .select('*, committees(name)')
    .eq('status', 'pending_head')
    .order('created_at', { ascending: false });

  // Calculate progress for each event
  const eventsWithProgress = eventProposals?.map((event: any) => {
    let progress = 0;
    if (event.status === 'approved' || event.status === 'in_progress') progress = 20;
    if (event.status === 'in_progress') progress = 60;
    return { ...event, progress };
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/dashboard" className="flex items-center gap-3">
              <DynamicLogo width={40} height={40} />
              <h1 className="text-2xl font-bold text-blue-600">IIChE AVVU Dashboard</h1>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard/profile" className="text-gray-700 hover:text-blue-600">Profile</Link>
              <span className="text-gray-700">{(profile as any).name}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {(profile as any).role.replace('_', ' ').toUpperCase()}
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
        <AnimatedSection delay={0.1}>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">
              Hi {(profile as any).name.split(' ')[0]}! 👋
            </h2>
            {committeeRole && (
              <p className="mt-2 text-base font-medium text-gray-800">
                {committeeRole}
              </p>
            )}
            {isExecutive && (
              <div className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg">
                <Crown className="w-5 h-5" />
                <span className="font-bold">
                  IIChE Executive Committee - {(profile as any).executive_role?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            )}
            <p className="text-gray-600 mt-3">Welcome to your dashboard</p>
          </div>
        </AnimatedSection>

        {/* Pending Head Approvals Section */}
        <AnimatedSection delay={0.2}>
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Pending Head Approvals</h3>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <AnimatedPendingApprovals approvals={pendingHeadApprovals || []} />
            </div>
          </div>
        </AnimatedSection>

        {/* Event Progress Section */}
        <AnimatedSection delay={0.3}>
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Event Progress</h3>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <AnimatedEventProgress events={eventsWithProgress} />
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
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <AnimatedDashboardCard
                href="/dashboard/faculty"
                iconName="CheckCircle"
                title="Faculty Dashboard"
                description="Approve events, tasks, posters and finance"
                gradient
                gradientFrom="emerald-600"
                gradientTo="emerald-700"
                index={0}
              />
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
            <AnimatedDashboardCard
              href="/dashboard/tasks"
              iconName="Calendar"
              title="Tasks"
              description="View assigned tasks"
              iconColor="red-600"
              index={8}
            />
            <AnimatedDashboardCard
              href="/dashboard/proposals"
              iconName="Send"
              title="Proposals"
              description="Review event proposals"
              iconColor="orange-600"
              index={9}
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
            <div className="bg-white rounded-xl shadow-lg p-6">
              <AnimatedUpcomingEvents events={upcomingEvents || []} />
            </div>
          </div>
        </AnimatedSection>

        {/* Student Details Section */}
        <AnimatedSection delay={0.9}>
          <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">My Details</h3>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-bold text-gray-900">{(profile as any).name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-bold text-gray-900">{(profile as any).email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Username</p>
                  <p className="font-bold text-gray-900">{(profile as any).username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Role</p>
                  <p className="font-bold text-gray-900">{(profile as any).role.replace('_', ' ').toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {!isStudent && (
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
                {isExecutive && (
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
                  href="/dashboard/events/progress"
                  iconName="Trophy"
                  title="Event Progress"
                  description="Track tasks and updates"
                  iconColor="yellow-600"
                  index={3}
                />
              </div>
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
