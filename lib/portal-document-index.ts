import type { SupabaseClient } from '@supabase/supabase-js';
import { openDocumentsBucketFile, unwrapStoredFileUrl } from '@/lib/document-utils';
import { buildAttendanceReportCsv } from '@/lib/event-participant-groups';
import { formatPortalDateTime } from '@/lib/portal-date';

/** Live `document_type` enum: general | meeting_minutes | proposal | report | budget | contract | invoice | other */
export type LibraryDocumentType =
  | 'general'
  | 'meeting_minutes'
  | 'proposal'
  | 'report'
  | 'budget'
  | 'contract'
  | 'invoice'
  | 'other';

const EVENT_DOCS = 'event-documents';

export type IndexDocumentInput = {
  title: string;
  fileUrl: string;
  sourceKey: string;
  documentType: LibraryDocumentType;
  committeeId?: string | null;
  eventId?: string | null;
  taskId?: string | null;
  uploadedBy?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  metadata?: Record<string, unknown>;
};

export async function findCommitteeIdByName(supabase: SupabaseClient, namePart: string) {
  const { data } = await supabase
    .from('committees')
    .select('id')
    .ilike('name', `%${namePart}%`)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function indexPortalDocument(supabase: SupabaseClient, input: IndexDocumentInput) {
  if (!input.sourceKey) return;
  const now = new Date();
  const row = {
    title: input.title,
    file_url: input.fileUrl || '',
    file_type: input.fileType || null,
    file_size: input.fileSize ?? null,
    document_type: input.documentType,
    committee_id: input.committeeId || null,
    event_id: input.eventId || null,
    task_id: input.taskId || null,
    uploaded_by: input.uploadedBy || null,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    source_key: input.sourceKey,
    metadata: { source_key: input.sourceKey, ...(input.metadata || {}) },
  };
  const { error } = await supabase.from('documents').insert(row);
  if (!error) return;
  if (!/duplicate|unique/i.test(error.message || '')) {
    console.warn('indexPortalDocument:', error.message);
    return;
  }
  const { error: updErr } = await supabase.from('documents').update(row).eq('source_key', input.sourceKey);
  if (updErr) console.warn('indexPortalDocument update:', updErr.message);
}

export async function indexCompletedEventAttendanceReport(
  supabase: SupabaseClient,
  opts: { eventId: string; eventTitle: string; committeeId?: string | null; uploadedBy?: string | null },
) {
  await indexPortalDocument(supabase, {
    title: `Attendance report: ${opts.eventTitle || 'Event'}`,
    fileUrl: '',
    sourceKey: `attendance_report:${opts.eventId}`,
    documentType: 'report',
    committeeId: opts.committeeId || null,
    eventId: opts.eventId,
    uploadedBy: opts.uploadedBy || null,
    fileType: 'text/csv',
    metadata: { kind: 'attendance_report', event_id: opts.eventId, event_title: opts.eventTitle },
  });
}

export function isAttendanceReportDocument(doc: {
  metadata?: { kind?: string; event_id?: string } | null;
  event_id?: string | null;
}) {
  return String(doc.metadata?.kind || '') === 'attendance_report';
}

export async function downloadEventAttendanceReport(
  supabase: SupabaseClient,
  eventId: string,
  eventTitle?: string | null,
) {
  const [{ data: people, error }, { data: groups }] = await Promise.all([
    supabase
      .from('event_participants')
      .select('participant_name, participant_email, participant_group, registration_source, attendance_status, attended_at')
      .eq('event_id', eventId),
    supabase.from('event_participant_groups').select('name').eq('event_id', eventId).order('sort_order'),
  ]);
  if (error) throw new Error(error.message || 'Could not load attendance');
  const csv = buildAttendanceReportCsv(
    (people || []).map((p: {
      participant_name?: string | null;
      participant_email?: string | null;
      participant_group?: string | null;
      registration_source?: string | null;
      attendance_status?: string | null;
      attended_at?: string | null;
    }) => ({
      participant_name: p.participant_name,
      participant_email: p.participant_email,
      participant_group: p.participant_group,
      registration_source: p.registration_source,
      attendance_status: p.attendance_status,
      attended_at_label: p.attended_at ? formatPortalDateTime(p.attended_at) : '',
    })),
    (groups || []).map((g: { name?: string | null }) => String(g.name || '').trim()).filter(Boolean),
    true,
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = String(eventTitle || eventId)
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  a.download = `attendance-report-${slug || eventId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function syncPortalDocumentLibrary(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('sync_portal_documents_into_library');
  if (error) {
    console.warn('sync_portal_documents_into_library:', error.message);
    return 0;
  }
  return Number(data || 0);
}

function eventDocumentsObjectPath(raw: string): string | null {
  const s = unwrapStoredFileUrl(raw);
  if (!s) return null;
  const marker = '/object/public/event-documents/';
  const idx = s.indexOf(marker);
  if (idx !== -1) {
    const rest = s.slice(idx + marker.length).split(/[?#]/)[0];
    try {
      return rest ? decodeURIComponent(rest) : null;
    } catch {
      return rest || null;
    }
  }
  if (!/^https?:\/\//i.test(s)) return s.replace(/^\/+/, '') || null;
  return null;
}

export async function openIndexedDocument(supabase: SupabaseClient, raw: string | null | undefined) {
  const s = unwrapStoredFileUrl(raw);
  if (!s) return;
  const eventPath = eventDocumentsObjectPath(s);
  if (eventPath && (!/^https?:\/\//i.test(s) || s.includes('event-documents'))) {
    const { data } = supabase.storage.from(EVENT_DOCS).getPublicUrl(eventPath);
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
      return;
    }
  }
  await openDocumentsBucketFile(supabase, s);
}

export function documentKindLabel(doc: { document_type?: string | null; metadata?: { kind?: string } | null }) {
  const kind = String(doc.metadata?.kind || doc.document_type || '');
  if (kind === 'event_proposal' || kind === 'event_document') return 'Proposal';
  if (kind === 'task_document') return 'Task';
  if (kind === 'poster') return 'Poster';
  if (kind === 'meeting_minutes') return 'Minutes';
  if (kind === 'event_report') return 'Report';
  if (kind === 'attendance_report') return 'Attendance';
  if (kind === 'finance_document') return 'Finance';
  return '';
}
