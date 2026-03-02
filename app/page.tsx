import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Users, Crown, Calendar } from 'lucide-react';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  // Get upcoming events
  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('*')
    .gte('date', new Date().toISOString())
    .order('date')
    .limit(5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/kickoff" className="text-gray-700 hover:text-blue-600">Kickoff</Link>
              <Link href="/hiring" className="text-gray-700 hover:text-blue-600">Hiring</Link>
              {user ? (
                <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Dashboard</Link>
              ) : (
                <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">IIChE AVVU Chapter</h1>
          <p className="text-2xl text-gray-600 mb-8">Indian Institute of Chemical Engineers</p>
          <div className="flex gap-4 justify-center">
            <Link href="/committees" className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700">Explore Committees</Link>
            <Link href="/events" className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 border-2 border-blue-600">View Events</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">8+</div>
            <div className="text-gray-600">Active Committees</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">100+</div>
            <div className="text-gray-600">Active Members</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">50+</div>
            <div className="text-gray-600">Events Organized</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">About Us</h2>
          <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto">
            The IIChE AVVU Chapter is dedicated to promoting excellence in chemical engineering education and practice. 
            We organize technical events, workshops, seminars, and cultural activities to enhance the overall development of our members.
          </p>
        </div>

        {/* Committees Section */}
        <div className="mt-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Users className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Our Committees</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {committees?.map((committee: any) => (
              <Link key={committee.id} href={`/committees/${committee.id}`} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{committee.name}</h3>
                <p className="text-sm text-gray-600">{committee.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Executive Committee Section */}
        <div className="mt-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Crown className="w-8 h-8 text-yellow-600" />
            <h2 className="text-3xl font-bold text-gray-900">Executive Committee</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {executiveMembers?.map((member: any) => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition">
                  <p className="text-lg font-bold text-gray-900">{member.profile?.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{member.profile?.email}</p>
                  <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full mt-3 inline-block">
                    {member.position.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Events Section */}
        <div className="mt-16 mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Calendar className="w-8 h-8 text-green-600" />
            <h2 className="text-3xl font-bold text-gray-900">Upcoming Events</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-6">
                {upcomingEvents.map((event: any) => (
                  <div key={event.id} className="border-l-4 border-blue-500 pl-6 py-4 hover:bg-gray-50 transition">
                    <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                    <p className="text-gray-600 mt-2">{event.description}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      📅 {new Date(event.date).toLocaleDateString('en-IN', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {event.location && (
                      <p className="text-sm text-gray-500">📍 {event.location}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8 text-lg">No upcoming events at the moment</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
