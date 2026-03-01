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

    const attendanceMap = new Map(attendance?.map(a => [a.user_id, a.status]) || []);
    
    const attendeesList = invites?.map(inv => ({
      id: inv.user.id,
      name: inv.user.name,
      status: attendanceMap.get(inv.user.id) || 'absent'
    })) || [];

    setAttendees(attendeesList);
  }

  async function markAttendance(userId: string, status: string) {
    const { error } = await supabase
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meetings</h1>
          <Link
            href="/dashboard/meetings/create"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Schedule Meeting
          </Link>
        </div>

        <div className="space-y-4">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {meeting.meeting_type === 'online' ? (
                      <Video className="w-5 h-5 text-blue-600" />
                    ) : (
                      <MapPin className="w-5 h-5 text-green-600" />
                    )}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{meeting.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      meeting.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      meeting.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {meeting.status}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">{meeting.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(meeting.meeting_date).toLocaleString()}
                    </span>
                    <span>{meeting.duration} mins</span>
                    <span>By {meeting.creator?.name}</span>
                  </div>
                  {meeting.meeting_type === 'online' && meeting.meeting_link && (
                    <a
                      href={meeting.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Join Meeting →
                    </a>
                  )}
                  {meeting.meeting_type === 'offline' && (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      📍 {meeting.location}
                    </p>
                  )}
                </div>
                {meeting.meeting_type === 'offline' && (
                  <button
                    onClick={() => openAttendance(meeting)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Mark Attendance
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {meetings.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No meetings scheduled yet.</p>
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
