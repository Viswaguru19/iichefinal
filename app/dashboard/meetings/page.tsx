'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, MapPin, Video, Users, Clock } from 'lucide-react';
import Link from 'next/link';

export default function MeetingsPage() {
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [pastMeetings, setPastMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadMeetings();
  }, []);

  async function loadMeetings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const now = new Date().toISOString();

      // Get upcoming meetings
      const { data: upcoming } = await supabase
        .from('meetings')
        .select(`
          *,
          creator:created_by(name),
          committee:committee_id(name),
          participants:meeting_participants(user_id, attended, profiles(name))
        `)
        .gte('meeting_date', now)
        .order('meeting_date', { ascending: true });

      setUpcomingMeetings(upcoming || []);

      // Get past meetings
      const { data: past } = await supabase
        .from('meetings')
        .select(`
          *,
          creator:created_by(name),
          committee:committee_id(name),
          participants:meeting_participants(user_id, attended, profiles(name))
        `)
        .lt('meeting_date', now)
        .order('meeting_date', { ascending: false })
        .limit(20);

      setPastMeetings(past || []);
    } catch (error: any) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  }

  const getMeetingIcon = (type: string) => {
    return type === 'online' ? <Video className="w-5 h-5" /> : <MapPin className="w-5 h-5" />;
  };

  const getPlatformBadge = (platform: string) => {
    const colors: any = {
      microsoft_teams: 'bg-blue-100 text-blue-800',
      google_meet: 'bg-green-100 text-green-800',
      zoom: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[platform] || colors.other;
  };

  const displayedMeetings = filter === 'upcoming' ? upcomingMeetings :
    filter === 'past' ? pastMeetings :
      [...upcomingMeetings, ...pastMeetings];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-blue-600"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-blue-600">Meetings</h1>
            </div>
            <Link
              href="/dashboard/meetings/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Schedule Meeting
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-600 mb-6">
          All members can schedule and manage meetings. Meetings are visible to everyone.
        </p>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'upcoming'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
          >
            Upcoming ({upcomingMeetings.length})
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'past'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
          >
            Past ({pastMeetings.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
          >
            All ({upcomingMeetings.length + pastMeetings.length})
          </button>
        </div>

        {/* Meetings Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMeetings.map((meeting) => {
            const meetingDate = new Date(meeting.meeting_date);
            const isPast = meetingDate < new Date();
            const participantCount = meeting.participants?.length || 0;

            return (
              <div
                key={meeting.id}
                className={`bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition flex flex-col h-full ${isPast ? 'opacity-75' : ''
                  }`}
              >
                {/* Meeting Type Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {getMeetingIcon(meeting.meeting_type)}
                    <span className="font-semibold text-gray-900">
                      {meeting.meeting_type === 'online' ? 'Online' : 'In-Person'}
                    </span>
                  </div>
                  {isPast && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      Completed
                    </span>
                  )}
                </div>

                {/* Meeting Title */}
                <h3 className="text-lg font-bold text-gray-900 mb-2">{meeting.title}</h3>

                {/* Committee */}
                {meeting.committee && (
                  <p className="text-sm text-gray-600 mb-3">{meeting.committee.name}</p>
                )}

                {/* Description */}
                {meeting.description && (
                  <p className="text-sm text-gray-700 mb-4 line-clamp-2 flex-grow">{meeting.description}</p>
                )}

                <div className="mt-auto space-y-2">
                  {/* Date & Time */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{meetingDate.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{meetingDate.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} • {meeting.duration} min</span>
                  </div>
                </div>

                {/* Location/Platform */}
                {meeting.meeting_type === 'online' ? (
                  <div className="mb-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPlatformBadge(meeting.platform)}`}>
                      {meeting.platform?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    {meeting.meeting_link && !isPast && (
                      <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Join Meeting →
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-gray-600 mb-4">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{meeting.location}</span>
                  </div>
                )}

                {/* Participants */}
                <div className="flex items-center gap-2 text-sm text-gray-600 pt-4 border-t border-gray-200">
                  <Users className="w-4 h-4" />
                  <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Agenda */}
                {meeting.agenda && (
                  <details className="mt-4">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600">
                      View Agenda
                    </summary>
                    <p className="text-sm text-gray-600 mt-2 pl-4">{meeting.agenda}</p>
                  </details>
                )}

                {/* Minutes (for past meetings) */}
                {isPast && meeting.minutes && (
                  <details className="mt-4">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600">
                      View Minutes
                    </summary>
                    <p className="text-sm text-gray-600 mt-2 pl-4">{meeting.minutes}</p>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {displayedMeetings.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No meetings found</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'upcoming' ? 'No upcoming meetings scheduled' :
                filter === 'past' ? 'No past meetings recorded' :
                  'No meetings have been scheduled yet'}
            </p>
            <Link
              href="/dashboard/meetings/create"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Schedule Your First Meeting
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
