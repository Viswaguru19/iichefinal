'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [summary, setSummary] = useState('');
  const [venue, setVenue] = useState('');
  const [participants, setParticipants] = useState('');
  const [highlights, setHighlights] = useState('');
  const [photosUrl, setPhotosUrl] = useState('');
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

    const { data: reportsData } = await supabase
      .from('event_reports')
      .select('*, proposals:event_proposals(title), uploader:profiles(name)')
      .order('created_at', { ascending: false });
    setReports(reportsData || []);

    const { data: eventsData } = await supabase
      .from('event_proposals')
      .select('id, title')
      .eq('status', 'approved');
    setEvents(eventsData || []);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from('event_reports')
        .insert({
          proposal_id: selectedEvent,
          summary,
          venue,
          participants_count: parseInt(participants) || 0,
          highlights,
          photos_url: photosUrl,
          document_url: documentUrl,
          uploaded_by: user?.id
        });

      if (error) throw error;

      toast.success('Report uploaded!');
      setShowUpload(false);
      setSummary('');
      setVenue('');
      setParticipants('');
      setHighlights('');
      setPhotosUrl('');
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
            <h1 className="text-2xl font-bold text-blue-600">Event Reports</h1>
            <div className="flex gap-4">
              {canUpload && (
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Report
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
            <h2 className="text-xl font-bold mb-4">Upload Event Report</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event *</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Summary *</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Venue</label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Participants</label>
                  <input
                    type="number"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Highlights</label>
                <textarea
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Photos URL</label>
                <input
                  type="url"
                  value={photosUrl}
                  onChange={(e) => setPhotosUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Document URL</label>
                <input
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Uploading...' : 'Upload Report'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    {report.proposals?.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">By: {report.uploader?.name}</p>
                </div>
              </div>

              <p className="text-gray-700 mb-4">{report.summary}</p>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                {report.venue && (
                  <div>
                    <span className="font-medium">Venue:</span> {report.venue}
                  </div>
                )}
                {report.participants_count > 0 && (
                  <div>
                    <span className="font-medium">Participants:</span> {report.participants_count}
                  </div>
                )}
              </div>

              {report.highlights && (
                <div className="mb-4">
                  <span className="font-medium text-sm">Highlights:</span>
                  <p className="text-sm text-gray-600 mt-1">{report.highlights}</p>
                </div>
              )}

              <div className="flex gap-2">
                {report.photos_url && (
                  <a
                    href={report.photos_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Photos
                  </a>
                )}
                {report.document_url && (
                  <a
                    href={report.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Document
                  </a>
                )}
              </div>
            </div>
          ))}

          {reports.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <p className="text-gray-600">No reports uploaded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
