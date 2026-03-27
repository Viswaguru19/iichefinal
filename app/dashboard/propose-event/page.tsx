

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
  const [budget, setBudget] = useState('');
  const [duration, setDuration] = useState('');
  const [guestName, setGuestName] = useState('');
  const [expectedParticipants, setExpectedParticipants] = useState('');
  const [isGuestLecture, setIsGuestLecture] = useState(false);
  const [registrationFee, setRegistrationFee] = useState('');
  const [prize, setPrize] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  // legacy workflow checkboxes removed – tracked separately now
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload documents first if any
      const uploadedDocs: any[] = [];
      if (documents.length > 0) {
        setUploading(true);
        for (const file of documents) {
          const fileName = `${Date.now()}_${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('event-documents')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('event-documents')
            .getPublicUrl(fileName);

          uploadedDocs.push({
            name: file.name,
            url: publicUrl,
            uploaded_at: new Date().toISOString(),
            uploaded_by: user.id
          });
        }
        setUploading(false);
      }

      // determine which committee the user belongs to - we only care about the
      // first non-executive committee they are a member of. the old workflow
      // used event_proposals but builds the new system directly on `events`.
      const { data: membership } = await supabase
        .from('committee_members')
        .select('committee_id')
        .eq('user_id', user.id)
        .neq('committee_id', '00000000-0000-0000-0000-000000000001')
        .single();

      // Role-based initial routing:
      // Faculty/Admin -> active (bypass pipeline)
      // EC (executive_role) -> pending_faculty_approval
      // All committee proposals (including head/co-head proposers) -> pending_head_approval
      // so the committee head reviews first; EC comes only after head approval.
      const { data: profile } = await supabase
        .from('profiles')
        .select('executive_role, is_faculty, is_admin')
        .eq('id', user.id)
        .single();

      const isExecutive = profile?.executive_role != null;
      const isFacultyOrAdmin = !!(profile?.is_faculty || profile?.is_admin);
      const initialStatus =
        isFacultyOrAdmin ? 'active' :
          isExecutive ? 'pending_faculty_approval' :
            'pending_head_approval';

      // insert into the `events` table with the correct initial status. this
      // ensures the proposal appears in the proposals screen (which only
      // queries `events`) and routes to the committee head for approval.
      const { error } = await supabase
        .from('events')
        .insert({
          title,
          description,
          date: new Date(eventDate).toISOString(),
          location,
          budget: parseFloat(budget) || null,
          event_duration: duration || null,
          guest_name: isGuestLecture ? guestName || null : null,
          expected_participants: parseInt(expectedParticipants) || null,
          registration_fee: registrationFee || null,
          prize: prize || null,
          committee_id: (membership as any)?.committee_id,
          proposed_by: user.id,
          status: initialStatus,
          created_by: user.id,
          documents: uploadedDocs
        });

      if (error) throw error;

      toast.success('Event proposal submitted!');
      router.push('/dashboard/proposals');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setUploading(false);
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

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2 hours" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget (₹)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 3000" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Participants</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={expectedParticipants} onChange={(e) => setExpectedParticipants(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 50" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isGuestLecture} onChange={(e) => setIsGuestLecture(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm font-medium text-gray-700">This is a Guest Lecture</span>
              </label>
              {isGuestLecture && (
                <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Name of the guest speaker" className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registration Fee</label>
                <input type="text" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} placeholder="e.g. Free / ₹100 / ₹50 per team" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prize</label>
                <input type="text" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="e.g. ₹5000 / Certificates / Trophies" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents (Optional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  if (picked.length === 0) return;
                  setDocuments((prev) => {
                    const byKey = new Map<string, File>();
                    [...prev, ...picked].forEach((f) => byKey.set(`${f.name}-${f.size}-${f.lastModified}`, f));
                    return Array.from(byKey.values());
                  });
                  e.currentTarget.value = '';
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload proposal documents, budget sheets, or other supporting files
              </p>
              {documents.length > 0 && (
                <div className="mt-2 space-y-1">
                  {documents.map((file, idx) => (
                    <div key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                      <span>📄 {file.name}</span>
                      <button
                        type="button"
                        onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || uploading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send className="w-5 h-5" />
              {uploading ? 'Uploading documents...' : loading ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
