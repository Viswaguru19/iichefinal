'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';

export default function ProposeEventPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [requiresResourcePerson, setRequiresResourcePerson] = useState(false);
  const [resourcePersonDetails, setResourcePersonDetails] = useState('');
  const [requiresHall, setRequiresHall] = useState(true);
  const [requiresStudentWelfare, setRequiresStudentWelfare] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: membership } = await supabase
        .from('committee_members')
        .select('committee_id, position')
        .eq('user_id', user.id)
        .neq('committee_id', '00000000-0000-0000-0000-000000000001')
        .single();

      const isCoHead = (membership as any)?.position === 'co_head';
      const initialStatus = isCoHead ? 'pending_head' : 'pending_executive';

      const { error } = await (supabase as any)
        .from('event_proposals')
        .insert({
          title,
          description,
          proposed_by_committee: (membership as any)?.committee_id,
          proposed_by_user: user.id,
          event_date: eventDate,
          location,
          requires_resource_person: requiresResourcePerson,
          resource_person_details: resourcePersonDetails,
          requires_hall: requiresHall,
          requires_student_welfare: requiresStudentWelfare,
          status: initialStatus,
        });

      if (error) throw error;

      toast.success('Event proposal submitted!');
      router.push('/dashboard/proposals');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Propose Event</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Date *</label>
                <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

<div className="space-y-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={requiresHall} onChange={(e) => setRequiresHall(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-gray-700">Requires Hall Booking</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={requiresStudentWelfare} onChange={(e) => setRequiresStudentWelfare(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-gray-700">Requires Student Welfare Approval</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={requiresResourcePerson} onChange={(e) => setRequiresResourcePerson(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-gray-700">Requires Resource Person</span>
              </label>
            </div>

            {requiresResourcePerson && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resource Person Details</label>
                <textarea value={resourcePersonDetails} onChange={(e) => setResourcePersonDetails(e.target.value)} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Name, designation, contact..." />
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send className="w-5 h-5" />
              {loading ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
