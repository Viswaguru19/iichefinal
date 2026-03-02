'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Download, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MinutesPage() {
  const [minutes, setMinutes] = useState<any[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [loading, setLoading] = useState(false);
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

    setCanUpload((membership as any)?.committees?.name === 'Editorial Committee');

    const { data } = await supabase
      .from('meeting_minutes')
      .select('*, uploader:profiles(name)')
      .order('meeting_date', { ascending: false });

    setMinutes(data || []);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await (supabase as any)
        .from('meeting_minutes')
        .insert({
          title,
          purpose,
          meeting_date: meetingDate,
          document_url: documentUrl,
          uploaded_by: user?.id
        });

      if (error) throw error;

      toast.success('Minutes uploaded!');
      setShowUpload(false);
      setTitle('');
      setPurpose('');
      setMeetingDate('');
      setDocumentUrl('');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Minutes of Meeting</h1>
            <div className="flex gap-4">
              {canUpload && (
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              )}
              <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {showUpload && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Upload Minutes</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Purpose</label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date *</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Document URL *</label>
                <input
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  required
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">All Minutes</h2>
          <div className="space-y-4">
            {minutes.map((minute) => (
              <div key={minute.id} className="border rounded-lg p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      {minute.title}
                    </h3>
                    {minute.purpose && <p className="text-sm text-gray-600 mt-1">{minute.purpose}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(minute.meeting_date).toLocaleDateString('en-IN')}
                      </span>
                      <span>By: {minute.uploader?.name}</span>
                    </div>
                  </div>
                  <a
                    href={minute.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    View
                  </a>
                </div>
              </div>
            ))}
            {minutes.length === 0 && (
              <p className="text-gray-600 text-center py-8">No minutes uploaded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
