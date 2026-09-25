'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { openDocumentsBucketFile } from '@/lib/document-utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Upload, Download, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import {
  eventReportDocEventId,
  isEventReportDocument,
  syncMissingEditorialEventReports,
} from '@/lib/editorial-event-document';
import { formatPortalDate } from '@/lib/portal-date';

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
  const [syncing, setSyncing] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const selectedCommitteeName = useMemo(
    () => committees.find((c) => c.id === selectedCommittee)?.name || '',
    [committees, selectedCommittee],
  );
  const isEditorialSelected = /editorial/i.test(selectedCommitteeName);

  useEffect(() => {
    void loadData();
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
      .eq('type', 'regular')
      .order('name');
    setCommittees(allComs || []);

    // Default to Editorial Committee when first opening documents
    if (!selectedCommittee && allComs?.length) {
      const editorial = allComs.find((c: any) => /editorial/i.test(String(c.name || '')));
      if (editorial?.id) {
        setSelectedCommittee(editorial.id);
        return;
      }
    }

    if (selectedCommittee) {
      const editorial = (allComs || []).find((c: any) => c.id === selectedCommittee && /editorial/i.test(String(c.name || '')));
      if (editorial?.id) {
        setSyncing(true);
        try {
          const n = await syncMissingEditorialEventReports(supabase, user.id);
          if (n > 0) toast.success(`Added ${n} event report${n === 1 ? '' : 's'} to Editorial documents`);
        } catch (e) {
          console.warn('Event report sync failed', e);
        } finally {
          setSyncing(false);
        }
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('committee_id', selectedCommittee)
        .order('created_at', { ascending: false });
      if (error) console.error('Load docs error:', error);
      setDocuments(data || []);
    } else {
      setDocuments([]);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop();
      const path = `committee-docs/${selectedCommittee}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw new Error('File upload failed: ' + upErr.message);

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

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
          metadata: { original_name: file.name, description: description.trim() || null },
        });

      if (insertErr) throw new Error('Save failed: ' + insertErr.message);

      toast.success('Document uploaded!');
      setShowUpload(false);
      setTitle('');
      setDescription('');
      setFile(null);
      void loadData();
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
    else { toast.success('Deleted'); void loadData(); }
  }

  const canUpload = userCommittees.some((c: any) => c.committee_id === selectedCommittee);

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere subtitle="Upload and browse committee files. Event reports appear under Editorial." />
      <PageHeader title="Committee Documents" gradientTitle />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="mb-6 flex gap-4 flex-wrap">
          <select
            value={selectedCommittee}
            onChange={(e) => setSelectedCommittee(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl premium-input focus:ring-2 focus:ring-indigo-500"
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

        {isEditorialSelected && (
          <p className="text-sm text-gray-500 mb-4">
            Event reports are listed here under Editorial Committee, titled with the event name.
            {syncing ? ' Syncing reports…' : ''}
          </p>
        )}

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
              {documents.map((doc) => {
                const isReport = isEventReportDocument(doc);
                const eventId = eventReportDocEventId(doc);
                const hasFile = Boolean(String(doc.file_url || '').trim());
                return (
                  <div key={doc.id} className="premium-card rounded-xl p-4 hover:shadow-lg transition">
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold flex items-center gap-2 flex-wrap">
                          <FileText className="w-5 h-5 text-teal-600 shrink-0" />
                          <span className="truncate">{doc.title}</span>
                          {isReport && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                              Event report
                            </span>
                          )}
                        </h3>
                        {(doc.description || doc.metadata?.description) && (
                          <p className="text-sm text-gray-600 mt-1">{doc.description || doc.metadata?.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {isReport ? 'Submitted by Editorial · ' : ''}
                          {formatPortalDate(doc.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {isReport && eventId ? (
                          <Link
                            href={`/dashboard/event-detail/${eventId}`}
                            className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 text-sm"
                          >
                            <ExternalLink className="w-4 h-4" /> Open report
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled={!hasFile}
                            onClick={() => {
                              void openDocumentsBucketFile(supabase, doc.file_url).catch(() =>
                                toast.error('Could not open document')
                              );
                            }}
                            className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <Download className="w-4 h-4" /> View
                          </button>
                        )}
                        {canUpload && (
                          <button onClick={() => handleDelete(doc.id)}
                            className="px-3 py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition text-sm">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {documents.length === 0 && (
                <p className="text-gray-400 text-center py-8">
                  {isEditorialSelected
                    ? 'No event reports or documents yet for Editorial Committee'
                    : 'No documents uploaded yet'}
                </p>
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
