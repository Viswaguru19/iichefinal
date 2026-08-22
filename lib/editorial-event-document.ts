import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Upsert an Editorial Committee document row for a submitted event report.
 * Title uses the event name so it shows clearly in Documents.
 */
export async function upsertEditorialEventReportDocument(
  supabase: SupabaseClient,
  opts: {
    eventId: string;
    eventTitle: string;
    uploadedBy: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const title = String(opts.eventTitle || '').trim() || 'Untitled event';

  const { data: editComm, error: commErr } = await supabase
    .from('committees')
    .select('id')
    .ilike('name', '%editorial%')
    .limit(1)
    .maybeSingle();

  if (commErr) return { ok: false, error: commErr.message };
  if (!editComm?.id) return { ok: false, error: 'Editorial Committee not found' };

  const now = new Date();
  const payload = {
    title,
    file_url: '',
    file_type: 'event_report',
    document_type: 'event_document' as const,
    committee_id: editComm.id,
    event_id: opts.eventId,
    uploaded_by: opts.uploadedBy,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    metadata: {
      kind: 'event_report',
      event_id: opts.eventId,
      event_title: title,
      source: 'event_reports',
    },
  };

  const { data: existingByEvent } = await supabase
    .from('documents')
    .select('id')
    .eq('committee_id', editComm.id)
    .eq('event_id', opts.eventId)
    .limit(1)
    .maybeSingle();

  let existingId = existingByEvent?.id as string | undefined;

  if (!existingId) {
    const { data: byMeta } = await supabase
      .from('documents')
      .select('id, metadata')
      .eq('committee_id', editComm.id)
      .eq('file_type', 'event_report');

    const match = (byMeta || []).find((d: any) => {
      const meta = d.metadata || {};
      return String(meta.event_id || '') === opts.eventId;
    });
    existingId = match?.id;
  }

  if (existingId) {
    const { error } = await supabase.from('documents').update(payload).eq('id', existingId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from('documents').insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Backfill editorial docs for event reports that never got a documents row. */
export async function syncMissingEditorialEventReports(
  supabase: SupabaseClient,
  uploadedBy: string,
): Promise<number> {
  const { data: editComm } = await supabase
    .from('committees')
    .select('id')
    .ilike('name', '%editorial%')
    .limit(1)
    .maybeSingle();
  if (!editComm?.id) return 0;

  const { data: reports } = await supabase
    .from('event_reports')
    .select('id, event_id, created_by, events(id, title)')
    .order('created_at', { ascending: false });

  if (!reports?.length) return 0;

  const { data: existing } = await supabase
    .from('documents')
    .select('id, event_id, metadata')
    .eq('committee_id', editComm.id);

  const have = new Set<string>();
  for (const d of existing || []) {
    if (d.event_id) have.add(String(d.event_id));
    const mid = (d as any).metadata?.event_id;
    if (mid) have.add(String(mid));
  }

  let created = 0;
  for (const r of reports) {
    const eventId = String(r.event_id || '');
    if (!eventId || have.has(eventId)) continue;
    const ev = Array.isArray((r as any).events) ? (r as any).events[0] : (r as any).events;
    const title = String(ev?.title || '').trim();
    if (!title) continue;

    const res = await upsertEditorialEventReportDocument(supabase, {
      eventId,
      eventTitle: title,
      uploadedBy: String(r.created_by || uploadedBy),
    });
    if (res.ok) {
      have.add(eventId);
      created += 1;
    }
  }
  return created;
}

export function isEventReportDocument(doc: {
  file_type?: string | null;
  document_type?: string | null;
  event_id?: string | null;
  metadata?: any;
}): boolean {
  if (doc.file_type === 'event_report') return true;
  if (doc.metadata?.kind === 'event_report') return true;
  if (doc.document_type === 'event_document' && (doc.event_id || doc.metadata?.event_id)) return true;
  return false;
}

export function eventReportDocEventId(doc: {
  event_id?: string | null;
  metadata?: any;
}): string | null {
  if (doc.event_id) return String(doc.event_id);
  if (doc.metadata?.event_id) return String(doc.metadata.event_id);
  return null;
}
