import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Users, Calendar, Trophy, DollarSign, Crown, Send, MessageSquare } from 'lucide-react';

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
            <h1 className="text-2xl font-bold text-blue-600">IIChE AVVU Dashboard</h1>
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Hi {(profile as any).name.split(' ')[0]}{committeeRole ? `, ${committeeRole}` : ''}! 👋</h2>
          {isExecutive && (
            <div className="mt-2 inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg">
              <Crown className="w-5 h-5" />
              <span className="font-bold">IIChE Executive Committee - {(profile as any).executive_role?.replace('_', ' ').toUpperCase()}</span>
            </div>
          )}
          <p className="text-gray-600 mt-2">Welcome to your dashboard</p>
        </div>

        {/* Event Progress Section */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Pending Head Approvals</h3>
          <div className="bg-white rounded-xl shadow-lg p-6">
            {pendingHeadApprovals && pendingHeadApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingHeadApprovals.map((event: any) => (
                  <div key={event.id} className="flex justify-between items-center p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                    <div>
                      <h4 className="font-bold text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-600">{event.committees?.name}</p>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold">
                      WAITING FOR HEAD APPROVAL
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No pending head approvals</p>
            )}
          </div>
        </div>

        {/* Event Progress Section */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Event Progress</h3>
          <div className="bg-white rounded-xl shadow-lg p-6">
            {eventsWithProgress.length > 0 ? (
              <div className="space-y-4">
                {eventsWithProgress.map((event: any) => (
                  <Link key={event.id} href={`/dashboard/event-detail/${event.id}`} className="border border-gray-200 rounded-lg p-4 block hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900">{event.title}</h4>
                        <p className="text-sm text-gray-600">{event.committees?.name}</p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                        {event.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{event.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${event.progress}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No events in progress</p>
            )}
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

        <div className="mt-8 grid md:grid-cols-3 lg:grid-cols-5 gap-6">
          <Link href="/dashboard/chat" className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <MessageSquare className="w-8 h-8 mb-4" />
            <h3 className="text-lg font-bold">Chats</h3>
            <p className="text-sm text-green-100 mt-2">Messages & Groups</p>
          </Link>
          <Link href="/dashboard/propose-event" className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Send className="w-8 h-8 mb-4" />
            <h3 className="text-lg font-bold">Propose Event</h3>
            <p className="text-sm text-purple-100 mt-2">Submit event proposal</p>
          </Link>
          <Link href="/committees" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Users className="w-8 h-8 text-blue-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-900">View Committees</h3>
            <p className="text-sm text-gray-600 mt-2">See all committees and members</p>
          </Link>
          <Link href="/executive" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Crown className="w-8 h-8 text-yellow-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-900">Executive Committee</h3>
            <p className="text-sm text-gray-600 mt-2">View executive members</p>
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

        {/* Committees Section */}
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Committees</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {committees?.map((committee: any) => (
              <Link key={committee.id} href={`/committees/${committee.id}`} className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
                <h4 className="font-bold text-gray-900">{committee.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{committee.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Executive Committee Section */}
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Executive Committee</h3>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {executiveMembers?.map((member: any) => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-bold text-gray-900">{member.profile?.name}</p>
                  <p className="text-sm text-gray-600">{member.profile?.email}</p>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mt-2 inline-block">
                    {member.position.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Events Section */}
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Events</h3>
          <div className="bg-white rounded-xl shadow-lg p-6">
            {upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.map((event: any) => (
                  <div key={event.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <h4 className="font-bold text-gray-900">{event.title}</h4>
                    <p className="text-sm text-gray-600">{event.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.date).toLocaleDateString('en-IN', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No upcoming events</p>
            )}
          </div>
        </div>

        {/* Student Details Section */}
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
