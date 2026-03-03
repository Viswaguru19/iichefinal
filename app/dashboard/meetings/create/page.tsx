'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function CreateMeetingPage() {
  const [committees, setCommittees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [meetingType, setMeetingType] = useState('online');
  const [inviteType, setInviteType] = useState('all_committees');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchCommittees();
  }, []);

  async function fetchCommittees() {
    const { data } = await supabase
      .from('committees')
      .select('id, name')
      .order('name');
    setCommittees(data || []);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();

    const meetingData: any = {
      title: formData.get('title'),
      description: formData.get('description'),
      meeting_type: meetingType,
      meeting_date: formData.get('meeting_date'),
      duration: parseInt(formData.get('duration') as string),
      created_by: user?.id,
      invite_type: inviteType,
      agenda: formData.get('agenda')
    };

    if (meetingType === 'offline') {
      meetingData.location = formData.get('location');
    } else {
      meetingData.platform = formData.get('platform');
      meetingData.meeting_link = formData.get('meeting_link');
    }

    if (inviteType === 'specific_committee') {
      meetingData.committee_id = formData.get('committee_id');
    }

    const { data: meeting, error } = await (supabase as any)
      .from('meetings')
      .insert(meetingData)
      .select()
      .single();

    if (error || !meeting) {
      toast.error('Failed to create meeting');
      setLoading(false);
      return;
    }

    // Create invites based on invite type
    let invitees: string[] = [];

    if (inviteType === 'executive_only') {
      const { data: executives } = await supabase
        .from('profiles')
        .select('id')
        .not('executive_role', 'is', null);
      invitees = (executives as any)?.map((e: any) => e.id) || [];
    } else if (inviteType === 'specific_committee') {
      const { data: members } = await supabase
        .from('committee_members')
        .select('user_id')
        .eq('committee_id', formData.get('committee_id') as string);
      invitees = (members as any)?.map((m: any) => m.user_id) || [];
    } else {
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('approved', true);
      invitees = (allUsers as any)?.map((u: any) => u.id) || [];
    }

    if (invitees.length > 0) {
      const participantInserts = invitees.map(userId => ({
        meeting_id: meeting.id,
        user_id: userId
      }));

      await supabase
        .from('meeting_participants')
        .insert(participantInserts);
    }

    // Send email invitations to participants
    try {
      await fetch('/api/meetings/send-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id })
      });
    } catch (emailError) {
      console.error('Failed to send invitations:', emailError);
      // Don't fail the meeting creation if emails fail
    }

    toast.success('Meeting scheduled successfully');
    router.push('/dashboard/meetings');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/meetings" className="text-blue-600 hover:text-blue-700">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Schedule Meeting</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Title</label>
            <input
              type="text"
              name="title"
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Type</label>
            <select
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {meetingType === 'online' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
                <select
                  name="platform"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="microsoft_teams">Microsoft Teams</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Link</label>
                <input
                  type="url"
                  name="meeting_link"
                  placeholder="https://meet.google.com/..."
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location *</label>
              <input
                type="text"
                name="location"
                required
                placeholder="e.g., Main Auditorium, Room 301"
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                name="meeting_date"
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (minutes)</label>
              <input
                type="number"
                name="duration"
                defaultValue="60"
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agenda (Optional)</label>
            <textarea
              name="agenda"
              rows={3}
              placeholder="Meeting agenda and topics to discuss..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invite</label>
            <select
              value={inviteType}
              onChange={(e) => setInviteType(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all_committees">All Committees</option>
              <option value="executive_only">Executive Committee Only</option>
              <option value="specific_committee">Specific Committee</option>
            </select>
          </div>

          {inviteType === 'specific_committee' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Committee</label>
              <select
                name="committee_id"
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Choose committee</option>
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Scheduling...' : 'Schedule Meeting'}
          </button>
        </form>
      </div>
    </div>
  );
}
