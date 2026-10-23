'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Upload, Download, Trash2, ExternalLink, Folder, FolderOpen, ArrowLeft, ChevronRight, FolderPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import {
  eventReportDocEventId,
  isEventReportDocument,
  syncMissingEditorialEventReports,
} from '@/lib/editorial-event-document';
import { formatPortalDate } from '@/lib/portal-date';
import {
  documentKindLabel,
  downloadEventAttendanceReport,
  isAttendanceReportDocument,
  openIndexedDocument,
  syncPortalDocumentLibrary,
} from '@/lib/portal-document-index';

type CommitteeRow = { id: string; name: string };
type EventRow = { id: string; title: string; committee_id?: string | null };
type FolderRow = { id: string; committee_id: string; parent_id: string | null; name: string };
type DocRow = {
  id: string;
  title: string;
  file_url?: string | null;
  document_url?: string | null;
  committee_id?: string | null;
  event_id?: string | null;
  folder_id?: string | null;
  file_type?: string | null;
  document_type?: string | null;
  created_at: string;
  description?: string | null;
  metadata?: { description?: string | null; kind?: string; event_title?: string; event_id?: string } | null;
};

function fileUrlOf(doc: DocRow) {
  return String(doc.file_url || doc.document_url || '').trim();
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [userCommitteeIds, setUserCommitteeIds] = useState<string[]>([]);
  const [libraryTab, setLibraryTab] = useState<'committees' | 'events'>('committees');
  const [openCommitteeId, setOpenCommitteeId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const openCommittee = useMemo(
    () => committees.find((c) => c.id === openCommitteeId) || null,
    [committees, openCommitteeId],
  );
  const openFolder = useMemo(() => folders.find((f) => f.id === openFolderId) || null, [folders, openFolderId]);
  const openEvent = useMemo(() => events.find((e) => e.id === openEventId) || null, [events, openEventId]);
  const viewingEventLibrary = Boolean(openEventId && !openCommitteeId);
  const canUpload = viewingEventLibrary
    ? userCommitteeIds.length > 0
    : Boolean(openCommitteeId && userCommitteeIds.includes(openCommitteeId));

  function linkedEventId(doc: DocRow) {
    return doc.event_id || eventReportDocEventId(doc) || doc.metadata?.event_id || null;
  }

  const committeeDocs = useMemo(
    () =>
      documents.filter(
        (d) => d.committee_id === openCommitteeId && String(d.metadata?.kind || '') !== 'attendance_report',
      ),
    [documents, openCommitteeId],
  );

  const eventLibraryFolders = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const ev of events) {
      map.set(ev.id, { id: ev.id, title: ev.title || 'Event', count: 0 });
    }
    for (const d of documents) {
      const eid = linkedEventId(d);
      if (!eid) continue;
      const existing = map.get(eid);
      const title = existing?.title || d.metadata?.event_title || d.title || 'Event';
      map.set(eid, { id: eid, title, count: (existing?.count || 0) + 1 });
    }
    return [...map.values()].filter((e) => e.count > 0).sort((a, b) => a.title.localeCompare(b.title));
  }, [documents, events]);

  const childFolders = useMemo(
    () =>
      folders.filter(
        (f) => f.committee_id === openCommitteeId && f.parent_id === (openFolderId || null),
      ),
    [folders, openCommitteeId, openFolderId],
  );

  const visibleDocs = useMemo(() => {
    if (viewingEventLibrary && openEventId) {
      return documents.filter((d) => linkedEventId(d) === openEventId);
    }
    if (openFolderId) return committeeDocs.filter((d) => d.folder_id === openFolderId);
    return committeeDocs.filter((d) => !d.folder_id);
  }, [viewingEventLibrary, openEventId, openFolderId, committeeDocs, documents]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of documents) {
      if (!d.committee_id || String(d.metadata?.kind || '') === 'attendance_report') continue;
      map[d.committee_id] = (map[d.committee_id] || 0) + 1;
    }
    return map;
  }, [documents]);

  const loadLibrary = useCallback(async () => {
    const [docsRes, folderRes, eventRes] = await Promise.all([
      supabase
        .from('documents')
        .select('id, title, file_url, file_type, committee_id, event_id, folder_id, document_type, created_at, metadata')
        .order('created_at', { ascending: false }),
      supabase.from('document_folders').select('id, committee_id, parent_id, name').order('name'),
      supabase.from('events').select('id, title, committee_id').order('created_at', { ascending: false }),
    ]);
    if (docsRes.error) console.error('Load docs error:', docsRes.error);
    setEvents(eventRes.data || []);
    setFolders(folderRes.data || []);
    const data = docsRes.data;

    const { data: extra } = await supabase
      .from('committee_documents')
      .select('id, title, document_url, committee_id, created_at, description');
    const seen = new Set((data || []).map((d: DocRow) => d.id));
    const extras = (extra || [])
      .filter((d: { id: string; committee_id?: string | null }) => d.committee_id && !seen.has(d.id))
      .map(
        (d: {
          id: string;
          title: string;
          document_url?: string | null;
          committee_id: string;
          created_at: string;
          description?: string | null;
        }) => ({
          id: d.id,
          title: d.title,
          file_url: d.document_url,
          committee_id: d.committee_id,
          created_at: d.created_at,
          description: d.description,
        }),
      );
    setDocuments([...(data || []), ...extras]);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const [{ data: userComs }, { data: allComs }] = await Promise.all([
        supabase.from('committee_members').select('committee_id').eq('user_id', user.id),
        supabase.from('committees').select('id, name').eq('type', 'regular').order('name'),
      ]);
      setUserCommitteeIds((userComs || []).map((c: { committee_id: string }) => c.committee_id));
      setCommittees(allComs || []);

      setSyncing(true);
      try {
        const editorial = (allComs || []).find((c: CommitteeRow) => /editorial/i.test(c.name || ''));
        if (editorial?.id) {
          const n = await syncMissingEditorialEventReports(supabase, user.id);
          if (n > 0) toast.success(`Added ${n} event report${n === 1 ? '' : 's'} to Editorial`);
        }
        const indexed = await syncPortalDocumentLibrary(supabase);
        if (indexed > 0) toast.success(`Filed ${indexed} portal upload${indexed === 1 ? '' : 's'} into committee folders`);
      } catch (e) {
        console.warn('Document sync failed', e);
      } finally {
        setSyncing(false);
      }

      await loadLibrary();
      setPageLoading(false);
    })();
  }, [loadLibrary, router, supabase]);

  function resetToRoot(tab: 'committees' | 'events' = libraryTab) {
    setLibraryTab(tab);
    setOpenCommitteeId(null);
    setOpenFolderId(null);
    setOpenEventId(null);
    setShowUpload(false);
    setShowNewFolder(false);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const committeeId = openCommitteeId || userCommitteeIds[0] || openEvent?.committee_id || null;
    if (!file || !title.trim() || !committeeId) return;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop();
      const path = `committee-docs/${committeeId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw new Error('File upload failed: ' + upErr.message);

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

      const { error: insertErr } = await supabase.from('documents').insert({
        title: title.trim(),
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        document_type: 'general',
        committee_id: committeeId,
        event_id: openEventId,
        folder_id: openFolderId,
        uploaded_by: user.id,
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        metadata: {
          original_name: file.name,
          description: description.trim() || null,
          ...(openEventId
            ? { event_id: openEventId, event_title: openEventTitle, kind: 'event_document' }
            : {}),
        },
      });

      if (insertErr) throw new Error('Save failed: ' + insertErr.message);

      toast.success('Document uploaded!');
      setShowUpload(false);
      setTitle('');
      setDescription('');
      setFile(null);
      await loadLibrary();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim() || !openCommitteeId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('document_folders').insert({
      committee_id: openCommitteeId,
      parent_id: openFolderId,
      name: folderName.trim(),
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message || 'Could not create folder');
      return;
    }
    toast.success('Folder created');
    setFolderName('');
    setShowNewFolder(false);
    await loadLibrary();
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document?')) return;
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (error) {
      const again = await supabase.from('committee_documents').delete().eq('id', docId);
      if (again.error) toast.error(again.error.message || error.message || 'Delete failed');
      else {
        toast.success('Deleted');
        await loadLibrary();
      }
    } else {
      toast.success('Deleted');
      await loadLibrary();
    }
  }

  const openEventTitle =
    openEvent?.title ||
    eventLibraryFolders.find((e) => e.id === openEventId)?.title ||
    documents.find((d) => linkedEventId(d) === openEventId)?.metadata?.event_title ||
    'Event';

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere />
      <PageHeader title="Documents" gradientTitle />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="premium-card rounded-2xl p-1.5 sm:p-2 mb-6 flex gap-1.5 sm:gap-2 w-full max-w-full overflow-x-auto mobile-clean-scroll">
          <button
            type="button"
            onClick={() => resetToRoot('committees')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 ${libraryTab === 'committees' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}
          >
            Committees
          </button>
          <button
            type="button"
            onClick={() => resetToRoot('events')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 ${libraryTab === 'events' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}
          >
            Event documents
          </button>
        </div>

        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 flex-wrap">
          <button
            type="button"
            onClick={() => resetToRoot(libraryTab)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 ${openCommitteeId || openEventId ? 'hover:bg-white/70 hover:text-indigo-700' : 'text-indigo-700 font-semibold'}`}
          >
            <Folder className="w-4 h-4" /> {libraryTab === 'events' ? 'Event documents' : 'Committees'}
          </button>
          {openCommittee && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button
                type="button"
                onClick={() => {
                  setOpenFolderId(null);
                  setShowUpload(false);
                  setShowNewFolder(false);
                }}
                className="inline-flex items-center gap-1.5 font-semibold text-gray-800"
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                {openCommittee.name}
              </button>
            </>
          )}
          {viewingEventLibrary && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800">
                <FolderOpen className="w-4 h-4 text-sky-500" />
                {openEventTitle}
              </span>
            </>
          )}
          {openFolder && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                {openFolder.name}
              </span>
            </>
          )}
        </nav>

        {pageLoading ? (
          <div className="premium-panel rounded-2xl p-12 text-center text-gray-400">Loading folders…</div>
        ) : libraryTab === 'committees' && !openCommittee ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {committees.map((c) => {
              const n = counts[c.id] || 0;
              const mine = userCommitteeIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setLibraryTab('committees');
                    setOpenCommitteeId(c.id);
                    setOpenFolderId(null);
                    setOpenEventId(null);
                  }}
                  className="premium-card text-left rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <FolderOpen className="w-12 h-12 text-amber-400 drop-shadow-sm group-hover:scale-105 transition-transform" />
                    {mine && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Yours
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-bold text-gray-900 leading-snug">{c.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {n} {n === 1 ? 'document' : 'documents'}
                    {syncing ? ' · syncing…' : ''}
                  </p>
                </button>
              );
            })}
            {committees.length === 0 && (
              <p className="col-span-full text-center text-gray-400 py-8">No committees found.</p>
            )}
          </div>
        ) : libraryTab === 'events' && !openEventId ? (
          eventLibraryFolders.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No event files yet. Proposal, task, poster, and report files will appear here.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {eventLibraryFolders.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    setLibraryTab('events');
                    setOpenCommitteeId(null);
                    setOpenFolderId(null);
                    setOpenEventId(ev.id);
                  }}
                  className="premium-card text-left rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition group"
                >
                  <FolderOpen className="w-12 h-12 text-sky-500 drop-shadow-sm group-hover:scale-105 transition-transform" />
                  <h3 className="mt-3 font-bold text-gray-900 leading-snug">{ev.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {ev.count} {ev.count === 1 ? 'document' : 'documents'}
                  </p>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <div className="mb-5 flex gap-3 flex-wrap items-center">
              <button
                type="button"
                onClick={() => {
                  if (openFolderId) {
                    setOpenFolderId(null);
                    setShowUpload(false);
                    setShowNewFolder(false);
                  } else {
                    resetToRoot(libraryTab);
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              {canUpload && (
                <>
                  {openCommitteeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewFolder((v) => !v);
                      setShowUpload(false);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold"
                  >
                    <FolderPlus className="w-4 h-4" /> New folder
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUpload((v) => !v);
                      setShowNewFolder(false);
                    }}
                    className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 font-semibold"
                  >
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                </>
              )}
            </div>

            {showNewFolder && (
              <form onSubmit={(e) => void handleCreateFolder(e)} className="premium-panel rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
                <input
                  autoFocus
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <button type="submit" disabled={!folderName.trim()} className="btn-gradient-blue px-4 py-2 rounded-xl font-semibold disabled:opacity-50">
                  Create folder
                </button>
              </form>
            )}

            {showUpload && (
              <div className="premium-panel rounded-2xl p-6 mb-6">
                <h2 className="text-xl font-bold text-gradient mb-4">
                  Upload to {openFolder?.name || (openEventId ? openEventTitle : openCommittee?.name)}
                </h2>
                <form onSubmit={(e) => void handleUpload(e)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Title *</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">File *</label>
                    <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full px-4 py-2 border rounded-lg" />
                    {file && <p className="text-xs text-emerald-600 mt-1">Selected: {file.name}</p>}
                  </div>
                  <button type="submit" disabled={loading || !file || !title.trim()} className="w-full btn-gradient-blue py-3 rounded-xl font-semibold disabled:opacity-50">
                    {loading ? 'Uploading...' : 'Upload'}
                  </button>
                </form>
              </div>
            )}

            <div className="premium-panel rounded-2xl p-6">
              {openCommitteeId && childFolders.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {childFolders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setOpenFolderId(f.id);
                        setShowUpload(false);
                        setShowNewFolder(false);
                      }}
                      className="text-left rounded-xl border border-amber-100 bg-amber-50/60 p-3 hover:bg-amber-50"
                    >
                      <Folder className="w-9 h-9 text-amber-400" />
                      <p className="mt-2 font-semibold text-sm text-gray-900 truncate">{f.name}</p>
                      <p className="text-[11px] text-gray-500">Folder</p>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {visibleDocs.map((doc) => {
                  const isReport = isEventReportDocument(doc);
                  const isAttendance = isAttendanceReportDocument(doc);
                  const eventId = eventReportDocEventId(doc) || (isAttendance ? linkedEventId(doc) : null);
                  const hasFile = Boolean(fileUrlOf(doc));
                  const kind = documentKindLabel(doc);
                  const committeeName = committees.find((c) => c.id === doc.committee_id)?.name;
                  return (
                    <div key={doc.id} className="premium-card rounded-xl p-4 hover:shadow-lg transition">
                      <div className="flex justify-between items-start gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold flex items-center gap-2 flex-wrap">
                            <FileText className="w-5 h-5 text-teal-600 shrink-0" />
                            <span className="truncate">{doc.title}</span>
                            {(isReport || kind) && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                                {isReport ? 'Event report' : kind}
                              </span>
                            )}
                            {viewingEventLibrary && committeeName && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {committeeName}
                              </span>
                            )}
                          </h3>
                          {(doc.description || doc.metadata?.description) && (
                            <p className="text-sm text-gray-600 mt-1">{doc.description || doc.metadata?.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">{formatPortalDate(doc.created_at)}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {isAttendance && eventId ? (
                            <button
                              type="button"
                              onClick={() => {
                                void downloadEventAttendanceReport(supabase, eventId, doc.metadata?.event_title || doc.title).catch(
                                  () => toast.error('Could not download attendance report'),
                                );
                              }}
                              className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 text-sm"
                            >
                              <Download className="w-4 h-4" /> Download
                            </button>
                          ) : isReport && eventId ? (
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
                                void openIndexedDocument(supabase, fileUrlOf(doc)).catch(() =>
                                  toast.error('Could not open document'),
                                );
                              }}
                              className="btn-gradient-blue px-4 py-2 rounded-xl flex items-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
                            >
                              <Download className="w-4 h-4" /> View
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDelete(doc.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition text-sm font-semibold"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {visibleDocs.length === 0 && childFolders.length === 0 && (
                  <p className="text-gray-400 text-center py-8">
                    {canUpload ? 'This folder is empty. Upload a file or create a subfolder.' : 'No documents in this folder yet.'}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
