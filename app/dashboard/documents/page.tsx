'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { openDocumentsBucketFile } from '@/lib/document-utils';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [userCommittees, setUserCommittees] = useState<any[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => { loadData(); }, [selectedCommittee]);

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
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('committee_id', selectedCommittee)
        .order('created_at', { ascending: false });
      if (error) console.error('Load docs error:', error);
      setDocuments(data || []);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload file to storage
      const ext = file.name.split('.').pop();
      const path = `committee-docs/${selectedCommittee}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw new Error('File upload failed: ' + upErr.message);

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

      // Insert into documents table
      const { error: insertErr } = await supabase
        .from('documents')
        .insert({
          title: title.trim(),
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          document_type: 'general',
          committee_id: selectedCommittee,
          uploaded_by: user.id,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          metadata: { original_name: file.name },
        });

      if (insertErr) throw new Error('Save failed: ' + insertErr.message);

      toast.success('Document uploaded!');
      setShowUpload(false);
      setTitle('');
      setDescription('');
      setFile(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document?')) return;
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (error) toast.error('Delete failed');
    else { toast.success('Deleted'); loadData(); }
  }

  const canUpload = userCommittees.some((c: any) => c.committee_id === selectedCommittee);

  return (
    <div className="min-h-screen bg-mesh">
      <PageHeader title="Committee Documents" />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex gap-4">
          <select
            value={selectedCommittee}
            onChange={(e) => setSelectedCommittee(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl premium-input focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Committee</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {canUpload && selectedCommittee && (
            <button onClick={() => setShowUpload(!showUpload)}
              className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 font-semibold">
              <Upload className="w-4 h-4" /> Upload
            </button>
          )}
        </div>

        {showUpload && (
          <div className="premium-panel rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gradient mb-4">Upload Document</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                  className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">File *</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border rounded-lg" />
                {file && <p className="text-xs text-emerald-600 mt-1">Selected: {file.name}</p>}
              </div>
              <button type="submit" disabled={loading || !file || !title.trim()}
                className="w-full btn-gradient-blue py-3 rounded-xl font-semibold disabled:opacity-50">
                {loading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        )}

        {selectedCommittee ? (
          <div className="premium-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gradient mb-4">Documents</h2>
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="premium-card rounded-xl p-4 hover:shadow-lg transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" /> {doc.title}
                      </h3>
                      {doc.description && <p className="text-sm text-gray-600 mt-1">{doc.description}</p>}
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(doc.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!String(doc.file_url || '').trim()}
                        onClick={() => {
                          void openDocumentsBucketFile(supabase, doc.file_url).catch(() =>
                            toast.error('Could not open document')
                          );
                        }}
                        className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <Download className="w-4 h-4" /> View
                      </button>
                      {canUpload && (
                        <button onClick={() => handleDelete(doc.id)}
                          className="px-3 py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition text-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-gray-400 text-center py-8">No documents uploaded yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="premium-panel rounded-2xl p-12 text-center">
            <p className="text-gray-400">Select a committee to view documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
