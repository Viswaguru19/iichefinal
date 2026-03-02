'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Upload, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PostersPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGraphics, setIsGraphics] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: membership } = await supabase
      .from('committee_members')
      .select('committees(name)')
      .eq('user_id', user.id)
      .single();

    const graphics = (membership as any)?.committees?.name === 'Graphics Committee';
    setIsGraphics(graphics);

    if (!graphics) {
      toast.error('Only Graphics Committee can upload posters');
      return router.push('/dashboard');
    }

    const { data: approvedEvents } = await supabase
      .from('event_proposals')
      .select('id, title, committees(name)')
      .eq('status', 'approved')
      .is('poster_url', null);

    setEvents(approvedEvents || []);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!posterFile || !selectedEvent) return;

    setLoading(true);
    try {
      const fileName = `${Date.now()}_${posterFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payments')
        .upload(`posters/${fileName}`, posterFile);

      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      await (supabase as any)
        .from('event_posters')
        .insert({
          proposal_id: selectedEvent,
          poster_url: uploadData.path,
          uploaded_by: user?.id
        });

      await (supabase as any)
        .from('event_proposals')
        .update({ poster_url: uploadData.path })
        .eq('id', selectedEvent);

      toast.success('Poster uploaded successfully!');
      setPosterFile(null);
      setSelectedEvent('');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isGraphics) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Upload Event Posters</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Event *</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Choose event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {event.committees?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Poster *</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">JPG, PNG (Max 5MB)</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {loading ? 'Uploading...' : 'Upload Poster'}
            </button>
          </form>
        </div>

        {events.length === 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-8 text-center">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No approved events without posters</p>
          </div>
        )}
      </div>
    </div>
  );
}
