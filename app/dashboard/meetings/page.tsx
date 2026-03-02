'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Video, MapPin, Calendar } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchMeetings();
  }, []);

  async function fetchMeetings() {
    const { data } = await supabase
      .from('meetings')
      .select('*, creator:profiles(name)')
      .order('meeting_date', { ascending: false });

    setMeetings(data || []);
    setLoading(false);
  }

  async function openAttendance(meeting: any) {
    setSelectedMeeting(meeting);
    
    const { data: invites } = await supabase
      .from('meeting_invites')
      .select('user:profiles(id, name)')
      .eq('meeting_id', meeting.id);

    const { data: attendance } = await supabase
      .from('meeting_attendance')
      .select('user_id, status')
      .eq('meeting_id', meeting.id);

    const attendanceMap = new Map((attendance as any)?.map((a: any) => [a.user_id, a.status]) || []);
    
    const attendeesList = (invites as any)?.map((inv: any) => ({
      id: inv.user.id,
      name: inv.user.name,
      status: attendanceMap.get(inv.user.id) || 'absent'
    })) || [];

    setAttendees(attendeesList);
  }

  async function markAttendance(userId: string, status: string) {
    const { error } = await (supabase as any)
      .from('meeting_attendance')
      .upsert({
        meeting_id: selectedMeeting.id,
        user_id: userId,
        status
      }, { onConflict: 'meeting_id,user_id' });

    if (error) {
      toast.error('Failed to mark attendance');
    } else {
      toast.success('Attendance marked');
      openAttendance(selectedMeeting);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Google Meet Style Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-medium text-gray-900">Meetings</h1>
            </div>
            <Link
              href="/dashboard/meetings/create"
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-full hover:bg-blue-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              New meeting
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="bg-white border border-gray-200 rounded-lg hover:shadow-lg transition p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-lg ${
                  meeting.meeting_type === 'online' ? 'bg-blue-50' : 'bg-green-50'
                }`}>
                  {meeting.meeting_type === 'online' ? (
                    <Video className="w-6 h-6 text-blue-600" />
                  ) : (
                    <MapPin className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{meeting.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    meeting.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                    meeting.status === 'ongoing' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {meeting.status}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{meeting.description}</p>
              
              <div className="space-y-2 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(meeting.meeting_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div>{meeting.duration} minutes</div>
                <div className="text-xs">Organized by {meeting.creator?.name}</div>
              </div>

              {meeting.meeting_type === 'online' && meeting.meeting_link && (
                <a
                  href={meeting.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Join now
                </a>
              )}

              {meeting.meeting_type === 'offline' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">📍 {meeting.location}</p>
                  <button
                    onClick={() => openAttendance(meeting)}
                    className="w-full bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Mark attendance
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {meetings.length === 0 && (
          <div className="text-center py-16">
            <Video className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No meetings yet</h3>
            <p className="text-gray-500 mb-6">Create your first meeting to get started</p>
            <Link
              href="/dashboard/meetings/create"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              New meeting
            </Link>
          </div>
        )}
      </div>

      {selectedMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Attendance - {selectedMeeting.title}
            </h2>
            <div className="space-y-2">
              {attendees.map((attendee) => (
                <div key={attendee.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded">
                  <span className="text-gray-900 dark:text-white">{attendee.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markAttendance(attendee.id, 'present')}
                      className={`px-3 py-1 rounded text-sm ${
                        attendee.status === 'present'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => markAttendance(attendee.id, 'absent')}
                      className={`px-3 py-1 rounded text-sm ${
                        attendee.status === 'absent'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedMeeting(null)}
              className="mt-4 w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
