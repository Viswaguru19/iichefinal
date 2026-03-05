

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

      // insert into the `events` table with the correct initial status. this
      // ensures the proposal appears in the proposals screen (which only
      // queries `events`) and routes to the committee head for approval.
      const { error } = await supabase
        .from('events')
        .insert({
          title,
          description,
          date: new Date(eventDate).toISOString(),               // convert to proper timestamp
          location,
          budget: parseFloat(budget) || null,
          committee_id: (membership as any)?.committee_id,
          proposed_by: user.id,
          status: 'pending_head_approval',
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget (₹)</label>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents (Optional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                onChange={(e) => setDocuments(Array.from(e.target.files || []))}
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
