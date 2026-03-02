'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [userCommittees, setUserCommittees] = useState<any[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, [selectedCommittee]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: userComs } = await supabase
      .from('committee_members')
      .select('committee_id, committees(id, name)')
      .eq('user_id', user.id);
    setUserCommittees(userComs || []);

    const { data: allComs } = await supabase
      .from('committees')
      .select('id, name')
      .eq('type', 'regular');
    setCommittees(allComs || []);

    if (selectedCommittee) {
      const { data } = await supabase
        .from('committee_documents')
        .select('*, uploader:profiles(name), committees(name)')
        .eq('committee_id', selectedCommittee)
        .order('created_at', { ascending: false });
      setDocuments(data || []);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from('committee_documents')
        .insert({
          committee_id: selectedCommittee,
          title,
          description,
          document_url: documentUrl,
          uploaded_by: user?.id
        });

      if (error) throw error;

      toast.success('Document uploaded!');
      setShowUpload(false);
      setTitle('');
      setDescription('');
      setDocumentUrl('');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document?')) return;

    try {
      const { error } = await supabase
        .from('committee_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      toast.success('Document deleted!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const canUpload = userCommittees.some((c: any) => c.committee_id === selectedCommittee);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Committee Documents</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex gap-4">
          <select
            value={selectedCommittee}
            onChange={(e) => setSelectedCommittee(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg"
          >
            <option value="">Select Committee</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {canUpload && selectedCommittee && (
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          )}
        </div>

        {showUpload && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Upload Document</h2>
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
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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

        {selectedCommittee && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Documents</h2>
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        {doc.title}
                      </h3>
                      {doc.description && <p className="text-sm text-gray-600 mt-1">{doc.description}</p>}
                      <p className="text-xs text-gray-500 mt-2">
                        Uploaded by: {doc.uploader?.name} • {new Date(doc.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        View
                      </a>
                      {canUpload && (
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-gray-600 text-center py-8">No documents uploaded yet</p>
              )}
            </div>
          </div>
        )}

        {!selectedCommittee && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600">Select a committee to view documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
