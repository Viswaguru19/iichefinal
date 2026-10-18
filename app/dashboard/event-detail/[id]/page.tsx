'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Calendar, MapPin, CheckCircle, Clock, Edit, Check, X, Palette, ImageIcon, AlertCircle, Camera, ChevronLeft, ChevronRight, Users, QrCode, FileText, MessageSquare, Paperclip, ChevronDown } from 'lucide-react';
import { LinkedText } from '@/components/LinkedText';
import EventApprovalTrail from '@/components/events/EventApprovalTrail';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import DashboardAtmosphere from '@/components/react-bits/DashboardAtmosphere';
import ReminderButton from '@/components/ReminderButton';
import StatusIndicator from '@/components/StatusIndicator';
import EventReport from '@/components/EventReport';
import QRCode from 'qrcode';
import EventQrScanner, { type QrScanResult } from '@/components/events/EventQrScanner';
import EventParticipantManager from '@/components/events/EventParticipantManager';
import EventParticipantEmailPanel from '@/components/events/EventParticipantEmailPanel';
import { isManualParticipantSource, participantDisplayGroup, participantSecondaryText, registrationSourceLabel } from '@/lib/event-participant-groups';
import { isPortalAdmin } from '@/lib/permissions';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { insertPortalNotifications } from '@/lib/portal-notifications-client';
import { formatPortalDate, formatPortalDateTime } from '@/lib/portal-date';
import { notifyAllPortalUsers } from '@/lib/portal-notify-helpers';
import { computeEventOverallProgress, eventProgressTasks } from '@/lib/event-progress';

function taskSupportingDocHref(fileUrl: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/storage/v1/object/public/event-documents/${fileUrl}`;
}

function TaskSupportingDocuments({ docs }: { docs: any[] | null | undefined }) {
  if (!docs || docs.length === 0) return null;
  return (
    <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
      <p className="text-xs font-semibold text-indigo-800 mb-1.5">Supporting documents</p>
      <ul className="space-y-1">
        {docs.map((doc: any) => (
          <li key={doc.id}>
            <a
              href={taskSupportingDocHref(doc.file_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {doc.file_name || 'Document'}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Local datetime-local value from ISO timestamp. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sanitizeParticipantFormData(raw: any) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const duplicateKeys = new Set([
    'name',
    'full_name',
    'participant_name',
    'email',
    'participant_email',
    'mail',
    'group',
    'bulk_import',
    'added_manually',
  ]);
  const out: Record<string, unknown> = {};
  Object.entries(raw).forEach(([key, value]) => {
    const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!duplicateKeys.has(normalized)) out[key] = value;
  });
  return out;
}

type ParticipantRow = {
  id: string;
  participant_name?: string | null;
  form_response_id?: string | null;
  qr_data?: string | null;
  attendance_status?: string | null;
};

function parseQrPayload(raw: string): {
  payload: Record<string, unknown> | null;
  trimmed: string;
  candidates: string[];
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { payload: null, trimmed, candidates: [] };

  const tryParseJson = (text: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const safeDecode = (text: string): string | null => {
    try {
      return decodeURIComponent(text);
    } catch {
      return null;
    }
  };

  const decoded = safeDecode(trimmed);
  const unescaped = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const candidates = [trimmed, decoded || '', unescaped]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const urlLike = candidates.find((c) => /^https?:\/\//i.test(c));
  if (urlLike && /\/forms\/[^/\s?]+/i.test(urlLike)) {
    return {
      payload: null,
      trimmed,
      candidates,
      error: 'Registration form QR — use participant check-in QR',
    };
  }

  let parsed: Record<string, unknown> | null = null;
  for (const c of candidates) {
    parsed = tryParseJson(c);
    if (parsed) break;

    if (/^https?:\/\//i.test(c)) {
      try {
        const u = new URL(c);
        const qp = u.searchParams.get('payload') || u.searchParams.get('data') || u.searchParams.get('qr');
        if (qp) {
          const decQp = safeDecode(qp) || qp;
          parsed =
            tryParseJson(decQp) || tryParseJson(decQp.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
          if (parsed) break;
        }
      } catch {
        // ignore invalid URL
      }
    }

    const start = c.indexOf('{');
    const end = c.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = tryParseJson(c.slice(start, end + 1));
      if (parsed) break;
    }
  }

  return { payload: parsed, trimmed, candidates, error: parsed ? undefined : 'Invalid QR payload' };
}

function findParticipantLocally(
  payload: Record<string, unknown>,
  candidates: string[],
  eventId: string,
  rows: ParticipantRow[],
): ParticipantRow | null {
  const pid = payload.participant_id;
  if (pid != null && pid !== '') {
    const hit = rows.find((p) => p.id === String(pid));
    if (hit) return hit;
  }

  const responseId = payload.response_id;
  if (responseId) {
    const hit = rows.find((p) => p.form_response_id === String(responseId));
    if (hit) return hit;
  }

  const eid = payload.event_id;
  if (eid != null && eid !== '' && String(eid) !== String(eventId)) {
    return null;
  }

  for (const qrText of candidates) {
    const hit = rows.find((p) => p.qr_data === qrText);
    if (hit) return hit;
  }

  return null;
}

export default function EventDetailPage() {
  const EC_COMMITTEE_ID = '00000000-0000-0000-0000-000000000001';
  const [event, setEvent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEC, setIsEC] = useState(false);
  const [isFaculty, setIsFaculty] = useState(false);
  const [isGraphics, setIsGraphics] = useState(false);
  const [isEditorial, setIsEditorial] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editedTaskData, setEditedTaskData] = useState<any>({});
  const [eventPhotos, setEventPhotos] = useState<any[]>([]);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [viewingPhotos, setViewingPhotos] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'attendance'>(
    tabFromUrl === 'participants' || tabFromUrl === 'attendance' ? tabFromUrl : 'info',
  );
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [markingAttendanceId, setMarkingAttendanceId] = useState<string | null>(null);
  const [resettingAttendance, setResettingAttendance] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [eventQrImage, setEventQrImage] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const participantsRef = useRef<any[]>([]);
  const markAttendanceRef = useRef<
    (participantId: string, status?: 'present' | 'absent') => Promise<boolean>
  >(async () => false);
  const [slideshowUrls, setSlideshowUrls] = useState<Set<string>>(new Set());
  /** Faculty poster review: reject or request changes (with notes). */
  const [posterReviewOpen, setPosterReviewOpen] = useState(false);
  const [posterReviewKind, setPosterReviewKind] = useState<'reject' | 'alteration' | null>(null);
  const [posterReviewNotes, setPosterReviewNotes] = useState('');
  const [posterReviewSaving, setPosterReviewSaving] = useState(false);
  const [editingEventMeta, setEditingEventMeta] = useState(false);
  const [editEventDate, setEditEventDate] = useState('');
  const [editEventLocation, setEditEventLocation] = useState('');
  const [savingEventMeta, setSavingEventMeta] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'participants' || tab === 'attendance' || tab === 'info') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    loadEventDetails();
    loadUserProfile();
  }, []);
  useEffect(() => {
    void loadSlideshowSelections();
  }, []);
  useEffect(() => {
    if (!event?.id) return;
    if (activeTab === 'participants' || activeTab === 'attendance') {
      void loadParticipants();
    }
  }, [event?.id, activeTab]);

  async function loadParticipants(silent = false) {
    if (!event?.id) return;
    if (!silent) setParticipantsLoading(true);
    const { data, error } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load participants');
    setParticipants(data || []);
    if (!silent) setParticipantsLoading(false);
  }

  async function loadSlideshowSelections() {
    const { data } = await supabase
      .from('homepage_slideshow')
      .select('photo_url')
      .eq('is_active', true)
      .eq('approval_status', 'approved');
    setSlideshowUrls(new Set((data || []).map((d: any) => d.photo_url)));
  }

  async function togglePhotoInSlideshow(photo: any) {
    const photoUrl = photo.photo_url;
    const alreadyIn = slideshowUrls.has(photoUrl);
    try {
      if (alreadyIn) {
        const { error } = await supabase
          .from('homepage_slideshow')
          .delete()
          .eq('photo_url', photoUrl);
        if (error) throw error;
        toast.success('Removed from slideshow');
      } else {
        const { data: maxRows } = await supabase
          .from('homepage_slideshow')
          .select('display_order')
          .order('display_order', { ascending: false })
          .limit(1);
        const nextOrder = (maxRows?.[0]?.display_order || 0) + 1;
        const { error } = await supabase
          .from('homepage_slideshow')
          .insert({
            photo_url: photoUrl,
            title: event?.title ? `${event.title} Photo` : 'Event Photo',
            description: photo.caption || null,
            link_url: null,
            approval_status: 'approved',
            is_active: true,
            display_order: nextOrder,
          });
        if (error) throw error;
        toast.success('Added to slideshow');
      }
      await loadSlideshowSelections();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update slideshow');
    }
  }

  async function createEventQr() {
    if (!event?.id) return;
    const { data: eventForm } = await supabase
      .from('forms')
      .select('id')
      .eq('event_id', event.id)
      .eq('form_type', 'event_registration')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!eventForm?.id) {
      toast.error('No active event registration form found');
      return;
    }
    const formUrl = `${window.location.origin}/forms/${eventForm.id}?source=onsite`;
    const qr = await QRCode.toDataURL(formUrl, { width: 280, margin: 1 });
    setEventQrImage(qr);
    toast.success('On-spot registration QR ready — scan to open the event form; submitters are added as participants and marked present.');
  }

  async function markAttendance(
    participantId: string,
    status: 'present' | 'absent' = 'present',
  ): Promise<boolean> {
    const attendedAt = status === 'present' ? new Date().toISOString() : null;
    const previous = participants.find((p) => p.id === participantId);

    setMarkingAttendanceId(participantId);
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? {
              ...p,
              attendance_status: status,
              attended_at: status === 'present' ? attendedAt : null,
            }
          : p,
      ),
    );

    const updateData: Record<string, unknown> = { attendance_status: status };
    if (status === 'present') updateData.attended_at = attendedAt;
    else updateData.attended_at = null;

    const { data, error } = await supabase
      .from('event_participants')
      .update(updateData)
      .eq('id', participantId)
      .eq('event_id', event!.id)
      .select('*')
      .maybeSingle();
    setMarkingAttendanceId(null);

    if (error) {
      toast.error(error.message);
      if (previous) {
        setParticipants((prev) =>
          prev.map((p) => (p.id === participantId ? previous : p)),
        );
      } else {
        await loadParticipants(true);
      }
      return false;
    }

    if (!data) {
      toast.error('Participant not found for this event');
      if (previous) {
        setParticipants((prev) =>
          prev.map((p) => (p.id === participantId ? previous : p)),
        );
      } else {
        await loadParticipants(true);
      }
      return false;
    }

    setParticipants((prev) => {
      const exists = prev.some((p) => p.id === data.id);
      if (exists) {
        return prev.map((p) => (p.id === data.id ? { ...p, ...data } : p));
      }
      return [data, ...prev];
    });

    return true;
  }
  markAttendanceRef.current = markAttendance;

  async function resetAttendance() {
    const markedCount = participants.filter(
      (p) => p.attendance_status === 'present' || p.attendance_status === 'absent',
    ).length;
    if (markedCount === 0) {
      toast.error('No attendance marks to reset');
      return;
    }
    if (
      !confirm(
        `Reset attendance for ${markedCount} participant(s)? All present/absent marks will be cleared.`,
      )
    ) {
      return;
    }

    const snapshot = participants;
    setResettingAttendance(true);
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        attendance_status: 'registered',
        attended_at: null,
      })),
    );

    const { error } = await supabase
      .from('event_participants')
      .update({ attendance_status: 'registered', attended_at: null })
      .eq('event_id', event!.id)
      .in('attendance_status', ['present', 'absent']);

    setResettingAttendance(false);

    if (error) {
      toast.error(error.message || 'Failed to reset attendance');
      setParticipants(snapshot);
      return;
    }
    toast.success(`Attendance reset for ${markedCount} participant(s)`);
  }

  const processScanPayload = useCallback(
    async (raw: string): Promise<QrScanResult> => {
      try {
        const eventId = event?.id;
        if (!eventId) return { ok: false, message: 'Event not loaded' };

        const parsed = parseQrPayload(raw);
        if (parsed.error || !parsed.payload) {
          return { ok: false, message: parsed.error || 'Invalid QR payload' };
        }

        const payload = parsed.payload;
        const pid = payload.participant_id;
        if (pid == null || pid === '') {
          return { ok: false, message: 'Invalid participant QR' };
        }
        const eid = payload.event_id;
        if (eid != null && eid !== '' && String(eid) !== String(eventId)) {
          return { ok: false, message: 'QR is for a different event' };
        }

        const localRows = participantsRef.current as ParticipantRow[];
        let participantRow = findParticipantLocally(payload, parsed.candidates, eventId, localRows);

        if (!participantRow) {
          const responseId = payload.response_id;
          const qrCandidates = [
            parsed.trimmed,
            ...parsed.candidates,
            JSON.stringify(payload),
          ].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

          const lookups: Promise<{ id: string; participant_name: string | null } | null>[] = [
            Promise.resolve(
              supabase
                .from('event_participants')
                .select('id, participant_name')
                .eq('id', String(pid))
                .eq('event_id', eventId)
                .maybeSingle()
                .then(({ data }) => data),
            ),
          ];

          if (responseId) {
            lookups.push(
              Promise.resolve(
                supabase
                  .from('event_participants')
                  .select('id, participant_name')
                  .eq('form_response_id', String(responseId))
                  .eq('event_id', eventId)
                  .maybeSingle()
                  .then(({ data }) => data),
              ),
            );
          }

          for (const qrText of qrCandidates.slice(0, 3)) {
            lookups.push(
              Promise.resolve(
                supabase
                  .from('event_participants')
                  .select('id, participant_name')
                  .eq('event_id', eventId)
                  .eq('qr_data', qrText)
                  .maybeSingle()
                  .then(({ data }) => data),
              ),
            );
          }

          const results = await Promise.all(lookups);
          const hit = results.find((r) => r?.id);
          if (hit) {
            participantRow = {
              id: hit.id,
              participant_name: hit.participant_name,
              attendance_status: localRows.find((p) => p.id === hit.id)?.attendance_status,
            };
          }
        }

        if (!participantRow?.id) {
          return { ok: false, message: 'Participant not found — use check-in QR' };
        }

        const name = participantRow.participant_name || 'Participant';
        if (participantRow.attendance_status === 'present') {
          return { ok: true, message: `Already present: ${name}` };
        }

        const marked = await markAttendanceRef.current(participantRow.id, 'present');
        if (marked) {
          return { ok: true, message: `Present: ${name}` };
        }
        return { ok: false, message: `Could not mark ${name}` };
      } catch (err) {
        console.error('processScanPayload failed:', err);
        return { ok: false, message: 'Failed to process QR scan' };
      }
    },
    [event?.id, supabase],
  );

  async function handleScan() {
    const result = await processScanPayload(scanInput);
    if (!result.ok) toast.error(result.message);
    else toast.success(result.message);
    setScanInput('');
  }

  const handleQrScanned = useCallback(
    (decodedText: string) => processScanPayload(decodedText),
    [processScanPayload],
  );

  async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, committee_members(position, committee_id, committees(name))')
      .eq('id', user.id)
      .single();

    setUserProfile(profile);

    const isExecutive = !!(
      profile?.executive_role !== null ||
      profile?.committee_members?.some((m: any) => m.committee_id === EC_COMMITTEE_ID)
    );
    setIsEC(isExecutive);
    setIsFaculty(profile?.is_faculty === true || profile?.is_admin === true);

    const graphicsCommittee = profile?.committee_members?.find(
      (m: any) => m.committees?.name?.toLowerCase().includes('graphics')
    );
    setIsGraphics(!!graphicsCommittee);

    const editorialCommittee = profile?.committee_members?.find(
      (m: any) => m.committees?.name?.toLowerCase().includes('editorial')
    );
    setIsEditorial(!!editorialCommittee);
  }

  async function saveEventMeta() {
    if (!event?.id || !editEventDate.trim()) {
      toast.error('Date and time are required');
      return;
    }
    setSavingEventMeta(true);
    try {
      const when = new Date(editEventDate).toISOString();
      const location = editEventLocation.trim() || null;
      const { error } = await supabase
        .from('events')
        .update({
          event_date: when,
          date: when,
          location,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);
      if (error) throw error;
      setEvent({ ...event, event_date: when, date: when, location });
      setEditingEventMeta(false);
      toast.success('Event date and venue updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setSavingEventMeta(false);
    }
  }

  async function loadEventDetails() {
    try {
      // First, try to load the event with a simpler query
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, committees(name)')
        .eq('id', params.id)
        .single();

      console.log('Event query result:', { eventData, eventError, eventId: params.id });

      if (eventError) {
        console.error('Event query error:', eventError);
        toast.error('Event not found');
        setLoading(false);
        return;
      }

      // If event found, get the creator's profile separately
      if (eventData && eventData.created_by) {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', eventData.created_by)
          .single();

        if (creatorProfile) {
          eventData.created_by_profile = creatorProfile;
        }
      }

      if (eventData) {
        const approverIds = [
          eventData.head_approved_by,
          eventData.second_head_approved_by,
          eventData.faculty_approved_by,
        ].filter(Boolean);
        if (approverIds.length > 0) {
          const { data: approvers } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', approverIds);
          const byId = Object.fromEntries((approvers || []).map((p: any) => [p.id, p]));
          eventData.head_approver = byId[eventData.head_approved_by] || null;
          eventData.second_head_approver = byId[eventData.second_head_approved_by] || null;
          eventData.faculty_approver = byId[eventData.faculty_approved_by] || null;
        }
        const { data: ecApprovals } = await supabase
          .from('ec_approvals')
          .select('user_id, approved, approved_at, profiles(name, executive_role)')
          .eq('event_id', eventData.id)
          .eq('approved', true)
          .order('approved_at', { ascending: true });
        eventData.ec_approvals = ecApprovals || [];
      }

      setEvent(eventData);

      if (eventData) {
        const eventId = eventData.id;
        let { data: tasksData, error: tasksError } = await supabase
          .from('task_assignments')
          .select(`
            *,
            assigned_committee:assigned_to_committee(name),
            task_documents(id, file_name, file_url, file_type, created_at)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: true });

        if (tasksError) {
          const fallback = await supabase
            .from('task_assignments')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });
          tasksData = fallback.data;
          tasksError = fallback.error;
        }

        const rows = tasksData || [];
        if (rows.length > 0) {
          const ids = rows.map((t: any) => t.id);
          let { data: updatesData } = await supabase
            .from('task_updates')
            .select('*, user:updated_by(name)')
            .in('task_id', ids)
            .order('created_at', { ascending: true });
          if (!updatesData) {
            const plain = await supabase
              .from('task_updates')
              .select('*')
              .in('task_id', ids)
              .order('created_at', { ascending: true });
            updatesData = plain.data;
          }
          const byTask = new Map<string, any[]>();
          (updatesData || []).forEach((u: any) => {
            const list = byTask.get(u.task_id) || [];
            list.push(u);
            byTask.set(u.task_id, list);
          });
          const taskApproverIds = [...new Set(rows.map((t: any) => t.ec_approved_by).filter(Boolean))];
          let taskApprovers: Record<string, { name: string }> = {};
          if (taskApproverIds.length > 0) {
            const { data: people } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', taskApproverIds);
            taskApprovers = Object.fromEntries((people || []).map((p: any) => [p.id, p]));
          }
          rows.forEach((t: any) => {
            t.updates = byTask.get(t.id) || [];
            t.assigned_to = t.assigned_to || t.assigned_committee || null;
            t.approver = t.approver || taskApprovers[t.ec_approved_by] || null;
          });
        }

        if (tasksError) console.error('Tasks query error:', tasksError);
        setTasks(rows);

        // Load event photos
        const { data: photos } = await supabase
          .from('event_photos')
          .select('*, uploader:uploaded_by(name)')
          .eq('event_id', params.id)
          .order('created_at', { ascending: false });
        const photosWithUrls = (photos || []).map((p: any) => {
          const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(p.photo_url);
          return { ...p, photo_url: urlData.publicUrl };
        });
        setEventPhotos(photosWithUrls);
      }
    } catch (err) {
      console.error('Error loading event details:', err);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  }

  async function approveTask(taskId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = {
        status: 'approved',
        ec_approved_by: user.id,
        ec_approved_at: new Date().toISOString()
      };

      // Include deadline if set
      if (editedTaskData.deadline) {
        updateData.deadline = new Date(editedTaskData.deadline).toISOString();
      }

      const { error } = await supabase
        .from('task_assignments')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      // Send notification to assigned committee members
      const task = tasks.find(t => t.id === taskId);
      if (task?.assigned_to_committee) {
        await sendTaskApprovalNotification(taskId, task.assigned_to_committee, task.title);
      }

      toast.success('Task approved and assigned!');
      loadEventDetails();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve task');
    }
  }

  async function editAndApproveTask(taskId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update task with modifications in task_assignments table
      const { error } = await supabase
        .from('task_assignments')
        .update({
          ...editedTaskData,
          status: 'approved',
          ec_approved_by: user.id,
          ec_approved_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      // Send notification to assigned committee members
      const task = tasks.find(t => t.id === taskId);
      if (task?.assigned_to_committee) {
        await sendTaskApprovalNotification(taskId, task.assigned_to_committee, editedTaskData.title || task.title);
      }

      toast.success('Task updated and approved!');
      setEditingTask(null);
      setEditedTaskData({});
      loadEventDetails();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update and approve task');
    }
  }

  async function sendTaskApprovalNotification(taskId: string, committeeId: string, taskTitle: string) {
    try {
      // Get all members of the assigned committee
      const { data: members } = await supabase
        .from('committee_members')
        .select('user_id')
        .eq('committee_id', committeeId);

      if (!members || members.length === 0) return;

      // Create notifications for all committee members
      const notifications = members.map((member: { user_id: string }) => ({
        user_id: member.user_id,
        type: 'task_assigned',
        title: 'New Task Approved! 📋',
        message: `A task "${taskTitle}" has been approved by EC and assigned to your committee for event "${event?.title}". Check the Tasks section to start working on it.`,
        link: `/dashboard/tasks`,
        metadata: {
          task_id: taskId,
          event_id: event?.id,
          committee_id: committeeId,
        },
      }));

      await insertPortalNotifications(supabase, notifications);
    } catch (error) {
      console.error('Failed to send task approval notifications:', error);
    }
  }

  async function uploadEventPhoto() {
    if (!photoFile || !event || !userProfile) return;
    setUploadingPhoto(true);
    try {
      const ext = photoFile.name.split('.').pop();
      const path = `${event.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('event-photos').upload(path, photoFile);
      if (upErr) throw upErr;
      const { error } = await supabase.from('event_photos').insert({
        event_id: event.id, photo_url: path, uploaded_by: userProfile.id, caption: photoCaption || null,
      });
      if (error) throw error;
      toast.success('Photo uploaded!');
      setPhotoFile(null);
      setPhotoCaption('');
      setShowPhotoUpload(false);
      loadEventDetails();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadPoster(file: File) {
    if (!event) return;

    const { data: { user } } = await supabase.auth.getUser();
    const autoApprove = isPortalAdmin(userProfile);

    const fileExt = file.name.split('.').pop();
    const fileName = `${event.id}-${Date.now()}.${fileExt}`;
    const filePath = `event-posters/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('event-documents')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Failed to upload poster');
      return;
    }

    const posterUpdate = autoApprove
      ? {
          poster_url: filePath,
          poster_status: 'approved',
          poster_faculty_notes: null,
          poster_faculty_reviewed_at: new Date().toISOString(),
          poster_faculty_reviewed_by: user?.id ?? null,
        }
      : {
          poster_url: filePath,
          poster_status: 'pending_faculty_approval',
          poster_faculty_notes: null,
          poster_faculty_reviewed_at: null,
          poster_faculty_reviewed_by: null,
        };

    const { error: updateError } = await supabase
      .from('events')
      .update(posterUpdate)
      .eq('id', event.id);

    if (updateError) {
      await supabase.from('events').update({ poster_url: filePath }).eq('id', event.id);
    }

    if (!autoApprove) {
      const { data: facultyMembers } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_faculty', true);

      if (facultyMembers && facultyMembers.length > 0) {
        const notifications = facultyMembers.map((f: any) => ({
          user_id: f.id,
          type: 'poster_approval',
          title: 'Poster Pending Approval 🎨',
          message: `A poster for "${event.title}" has been uploaded by the Graphics team and needs your approval.`,
          link: `/dashboard/event-detail/${event.id}`,
          metadata: { event_id: event.id },
        }));
        await insertPortalNotifications(supabase, notifications);
      }
      toast.success('Poster uploaded! Sent to faculty for approval.');
    } else {
      await notifyAllPortalUsers(supabase, {
        type: 'poster',
        title: 'Event poster published',
        message: `Poster for "${event.title}" is now live after approval.`,
        link: `/dashboard/event-detail/${event.id}`,
        related_id: event.id,
      });
      toast.success('Poster uploaded and published — visible to everyone.');
    }

    loadEventDetails();
  }

  async function notifyGraphicsCommittee(eventId: string, title: string, body: string) {
    const { data: comm } = await supabase.from('committees').select('id').ilike('name', '%graphics%').limit(1).maybeSingle();
    if (!comm?.id) return;
    const { data: members } = await supabase.from('committee_members').select('user_id').eq('committee_id', comm.id);
    if (!members?.length) return;
    await insertPortalNotifications(
      supabase,
      members.map((m: any) => ({
        user_id: m.user_id,
        type: 'poster_feedback',
        title,
        message: body,
        link: `/dashboard/event-detail/${eventId}`,
      })),
    );
  }

  async function approvePosterAsFaculty() {
    if (!event) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('events')
      .update({
        poster_status: 'approved',
        poster_faculty_notes: null,
        poster_faculty_reviewed_at: new Date().toISOString(),
        poster_faculty_reviewed_by: user.id,
      })
      .eq('id', event.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Poster approved — visible to everyone now.');
    loadEventDetails();
  }

  async function submitPosterFacultyReview() {
    if (!event || !posterReviewKind) return;
    const notes = posterReviewNotes.trim();
    if (!notes) {
      toast.error('Please add notes for the graphics team.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPosterReviewSaving(true);
    try {
      const reviewedAt = new Date().toISOString();
      if (posterReviewKind === 'alteration') {
        const { error } = await supabase
          .from('events')
          .update({
            poster_status: 'needs_alteration',
            poster_faculty_notes: notes,
            poster_faculty_reviewed_at: reviewedAt,
            poster_faculty_reviewed_by: user.id,
          })
          .eq('id', event.id);
        if (error) throw error;
        await notifyGraphicsCommittee(
          event.id,
          'Poster: changes requested',
          `Faculty feedback for "${event.title}": ${notes}`,
        );
        toast.success('Sent back to Graphics with your notes.');
      } else {
        const { error } = await supabase
          .from('events')
          .update({
            poster_status: 'rejected',
            poster_url: null,
            poster_faculty_notes: notes,
            poster_faculty_reviewed_at: reviewedAt,
            poster_faculty_reviewed_by: user.id,
          })
          .eq('id', event.id);
        if (error) throw error;
        await notifyGraphicsCommittee(
          event.id,
          'Poster rejected',
          `Faculty rejected the poster for "${event.title}". Reason: ${notes}`,
        );
        toast.success('Poster rejected. Graphics has been notified.');
      }
      setPosterReviewOpen(false);
      setPosterReviewKind(null);
      setPosterReviewNotes('');
      loadEventDetails();
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    } finally {
      setPosterReviewSaving(false);
    }
  }

  if (loading) return <PortalLoadingScreen message="Loading event…" variant="events" />;

  if (!event) {
    return <div className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="text-gray-400">Event not found</div>
    </div>;
  }

  const approvedTasks = eventProgressTasks(tasks);
  const {
    overall: overallProgress,
    completed: completedTasks,
    total: totalTasks,
  } = computeEventOverallProgress(event, tasks);

  // Count pending tasks for EC approval
  const pendingECApprovalCount = tasks.filter(t => t.status === 'pending_ec_approval').length;

  let posterUrl = null;
  if (event.poster_url) {
    const { data } = supabase.storage
      .from('event-documents')
      .getPublicUrl(event.poster_url);
    posterUrl = data.publicUrl;
  }

  const isAdminUser = isPortalAdmin(userProfile);
  const userCommittees =
    userProfile?.committee_members?.map((m: any) => m.committee_id as string) || [];
  const canEditEventMeta =
    event.status !== 'cancelled' &&
    event.status !== 'completed' &&
    (isFaculty || isEC || isAdminUser || userCommittees.includes(event.committee_id));
  const canManageParticipants = !!userProfile;
  const canUploadPoster = isGraphics || isAdminUser;
  const posterPublished =
    !!event.poster_url &&
    (event.poster_status === 'approved' ||
      event.poster_status == null ||
      event.poster_status === '');
  const canPreviewPosterDraft =
    posterPublished ||
    !!(event.poster_url && (isFaculty || isGraphics || isAdminUser));
  const facultyPosterActions =
    isFaculty && event.poster_status === 'pending_faculty_approval' && !!event.poster_url;

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <DashboardAtmosphere subtitle="Poster, participants, attendance, and reports." />
      <PageHeader title="Event Details" gradientTitle />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="premium-card rounded-2xl p-1.5 sm:p-2 mb-6 flex gap-1.5 sm:gap-2 w-full max-w-full overflow-x-auto mobile-clean-scroll">
          <button onClick={() => setActiveTab('info')} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 ${activeTab === 'info' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}>Event Info</button>
          <button onClick={() => setActiveTab('participants')} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 ${activeTab === 'participants' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}>
            <span className="sm:hidden">Participants</span>
            <span className="hidden sm:inline">Participant Details</span>
          </button>
          <button onClick={() => setActiveTab('attendance')} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 ${activeTab === 'attendance' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white/70'}`}>
            <span className="sm:hidden">Attendance</span>
            <span className="hidden sm:inline">Participation / Attendance</span>
          </button>
        </div>
        {activeTab === 'info' && (
          <>
        {/* Event Poster — faculty approves before public visibility */}
        <div className="premium-panel rounded-2xl p-8 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex flex-wrap items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            Event Poster
            {event.poster_status === 'pending_faculty_approval' && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-semibold">Pending faculty approval</span>
            )}
            {event.poster_status === 'needs_alteration' && (
              <span className="text-xs bg-orange-100 text-orange-900 px-2 py-1 rounded-full font-semibold">Changes requested</span>
            )}
            {event.poster_status === 'approved' && event.poster_url && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-semibold">Published</span>
            )}
            {event.poster_status === 'rejected' && !event.poster_url && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-semibold">Rejected</span>
            )}
          </h3>

          {event.poster_status === 'needs_alteration' && event.poster_faculty_notes && (isGraphics || isFaculty || isAdminUser) && (
            <div className="mb-4 p-4 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-900">
              <p className="font-semibold text-orange-800 mb-1">Faculty feedback</p>
              <p className="whitespace-pre-wrap">{event.poster_faculty_notes}</p>
            </div>
          )}

          {posterUrl && canPreviewPosterDraft ? (
            <div className="relative">
              <img
                src={posterUrl}
                alt={event.title}
                className="w-full max-w-2xl mx-auto rounded-xl shadow-lg"
              />
              {facultyPosterActions && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void approvePosterAsFaculty()}
                    className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-semibold"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPosterReviewKind('alteration');
                      setPosterReviewNotes('');
                      setPosterReviewOpen(true);
                    }}
                    className="bg-amber-600 text-white px-5 py-2 rounded-lg hover:bg-amber-700 flex items-center gap-2 text-sm font-semibold"
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPosterReviewKind('reject');
                      setPosterReviewNotes('');
                      setPosterReviewOpen(true);
                    }}
                    className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-semibold"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
              {canUploadPoster && (
                <div className="mt-4 text-center">
                  <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer text-sm font-semibold">
                    <Palette className="w-4 h-4" />
                    {event.poster_status === 'needs_alteration' ? 'Upload revised poster' : 'Update poster'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadPoster(e.target.files[0])}
                    />
                  </label>
                  {isAdminUser && (
                    <p className="text-xs text-gray-500 mt-2">Admin uploads are published immediately.</p>
                  )}
                </div>
              )}
            </div>
          ) : posterUrl && !canPreviewPosterDraft ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-8 text-center text-amber-900 text-sm max-w-xl mx-auto">
              A poster is being reviewed by faculty. It will appear here for everyone after approval.
            </div>
          ) : (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-dashed border-purple-300 rounded-xl p-12 text-center">
              <Palette className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h4 className="text-lg font-bold text-purple-900 mb-2">Design in process</h4>
              <p className="text-purple-700 mb-4">
                {isAdminUser
                  ? 'Admins can upload a poster and it will be published immediately. Graphics uploads still go to faculty for approval.'
                  : 'The graphics team can upload a poster; it is sent to faculty for approval before it is shown to everyone.'}
              </p>
              {event.poster_status === 'rejected' && event.poster_faculty_notes && (isGraphics || isFaculty || isAdminUser) && (
                <div className="mb-4 text-left max-w-lg mx-auto p-3 rounded-lg bg-white/80 border border-red-100 text-sm text-gray-700 whitespace-pre-wrap">
                  <span className="font-semibold text-red-800">Last rejection reason: </span>
                  {event.poster_faculty_notes}
                </div>
              )}
              {canUploadPoster && (
                <label className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 cursor-pointer font-semibold">
                  <ImageIcon className="w-5 h-5" />
                  Upload poster
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadPoster(e.target.files[0])}
                  />
                </label>
              )}
              {isAdminUser && canUploadPoster && (
                <p className="text-xs text-purple-600 mt-3">Your upload will be published immediately — no faculty approval needed.</p>
              )}
            </div>
          )}
        </div>

        {posterReviewOpen && posterReviewKind && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {posterReviewKind === 'alteration' ? 'Request changes' : 'Reject poster'}
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                {posterReviewKind === 'alteration'
                  ? 'Graphics will see these notes and can upload a revised poster.'
                  : 'The poster file will be removed. Graphics will be notified with your reason.'}
              </p>
              <textarea
                value={posterReviewNotes}
                onChange={(e) => setPosterReviewNotes(e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Notes for the graphics team…"
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  disabled={posterReviewSaving}
                  onClick={() => void submitPosterFacultyReview()}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {posterReviewSaving ? 'Saving…' : 'Submit'}
                </button>
                <button
                  type="button"
                  disabled={posterReviewSaving}
                  onClick={() => {
                    setPosterReviewOpen(false);
                    setPosterReviewKind(null);
                    setPosterReviewNotes('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Photos Section */}
        <div className="premium-panel rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Camera className="w-6 h-6" /> Event Photos
            </h3>
            <button onClick={() => setShowPhotoUpload(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-semibold">
              <Camera className="w-4 h-4" /> Upload Photo
            </button>
          </div>
          {eventPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {eventPhotos.map((photo: any, idx: number) => (
                <div key={photo.id} className="relative group cursor-pointer" onClick={() => { setPhotoIndex(idx); setViewingPhotos(true); }}>
                  <img src={photo.photo_url} alt={photo.caption || 'Event photo'} className="w-full h-32 object-cover rounded-xl hover:opacity-90 transition" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePhotoInSlideshow(photo);
                    }}
                    className={`absolute top-2 right-2 text-[10px] px-2 py-1 rounded-md text-white transition ${slideshowUrls.has(photo.photo_url) ? 'bg-rose-600/85 hover:bg-rose-700' : 'bg-black/60 hover:bg-black/75'}`}
                    title={slideshowUrls.has(photo.photo_url) ? 'Remove from slideshow' : 'Add to slideshow'}
                  >
                    {slideshowUrls.has(photo.photo_url) ? 'Remove from slideshow' : 'Add to slideshow'}
                  </button>
                  {photo.caption && <p className="text-[10px] text-gray-500 mt-1 truncate">{photo.caption}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No photos uploaded yet. Be the first to share event moments!</p>
          )}
        </div>

        {/* Photo Upload Modal */}
        {showPhotoUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Upload Event Photo</h2>
                <button onClick={() => { setShowPhotoUpload(false); setPhotoFile(null); setPhotoCaption(''); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Photo *</label>
                  <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm" />
                </div>
                {photoFile && <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-full h-40 object-cover rounded-lg" />}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Caption (optional)</label>
                  <input type="text" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="Describe this photo..." className="w-full border border-gray-300 rounded-lg px-4 py-2" />
                </div>
                <div className="flex gap-3">
                  <button onClick={uploadEventPhoto} disabled={!photoFile || uploadingPhoto} className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                    {uploadingPhoto ? 'Uploading...' : 'Upload'}
                  </button>
                  <button onClick={() => { setShowPhotoUpload(false); setPhotoFile(null); setPhotoCaption(''); }} className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Viewer Modal */}
        {viewingPhotos && eventPhotos.length > 0 && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <button onClick={() => setViewingPhotos(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 text-2xl">✕</button>
            {eventPhotos.length > 1 && <>
              <button onClick={() => setPhotoIndex((photoIndex - 1 + eventPhotos.length) % eventPhotos.length)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/30 p-2 rounded-full"><ChevronLeft className="w-8 h-8" /></button>
              <button onClick={() => setPhotoIndex((photoIndex + 1) % eventPhotos.length)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/30 p-2 rounded-full"><ChevronRight className="w-8 h-8" /></button>
            </>}
            <div className="max-w-4xl max-h-[80vh] flex flex-col items-center">
              <img src={eventPhotos[photoIndex].photo_url} alt="" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              <div className="mt-3 text-center text-white">
                {eventPhotos[photoIndex].caption && <p className="text-lg">{eventPhotos[photoIndex].caption}</p>}
                <p className="text-sm text-gray-400 mt-1">By {eventPhotos[photoIndex].uploader?.name || 'Unknown'} · {photoIndex + 1}/{eventPhotos.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Event Info */}
        <div className="premium-panel rounded-2xl p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{event.title}</h2>
              <p className="text-lg text-gray-600 mt-2">{event.committees?.name}</p>
              <p className="text-sm text-gray-500">Created by: {event.created_by_profile?.name}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${event.status === 'approved' || event.status === 'active' ? 'bg-green-100 text-green-800' :
              event.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                event.status === 'rejected' || event.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
              }`}>
              {event.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          {/* Approval Reminder & Status */}
          <div className="flex items-center gap-3 mb-4">
            <StatusIndicator entityType="approval" timestamp={event.updated_at} currentStatus={event.status} />
            <ReminderButton entityId={event.id} entityType="approval" />
          </div>

          <p className="text-gray-700 mb-6">{event.description}</p>

          {Array.isArray(event.documents) && event.documents.length > 0 && (
            <div className="mb-6 p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <h4 className="text-sm font-semibold text-indigo-700 mb-2">Proposal Attachments</h4>
              <div className="space-y-1">
                {event.documents.map((doc: any, idx: number) => (
                  <a
                    key={`event-doc-${idx}`}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-indigo-600 hover:text-indigo-800 truncate"
                  >
                    {doc.name || `Attachment ${idx + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Schedule &amp; venue</h4>
              {canEditEventMeta && !editingEventMeta && (
                <button
                  type="button"
                  onClick={() => {
                    setEditEventDate(toDatetimeLocalValue(event.event_date || event.date));
                    setEditEventLocation(event.location || '');
                    setEditingEventMeta(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Edit className="w-4 h-4" />
                  Edit date &amp; venue
                </button>
              )}
            </div>

            {editingEventMeta ? (
              <div className="space-y-3 p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date &amp; time</label>
                  <input
                    type="datetime-local"
                    value={editEventDate}
                    onChange={(e) => setEditEventDate(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Venue</label>
                  <input
                    type="text"
                    value={editEventLocation}
                    onChange={(e) => setEditEventLocation(e.target.value)}
                    placeholder="e.g. Main auditorium, Block A"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Changes apply immediately — no re-approval needed.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingEventMeta}
                    onClick={() => void saveEventMeta()}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {savingEventMeta ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    disabled={savingEventMeta}
                    onClick={() => setEditingEventMeta(false)}
                    className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {event.event_date && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-5 h-5 shrink-0" />
                    <span>
                      {formatPortalDateTime(event.event_date)}
                    </span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-5 h-5 shrink-0" />
                    <span>{event.location}</span>
                  </div>
                )}
                {!event.event_date && !event.location && (
                  <p className="text-sm text-gray-500">No date or venue set yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {event.event_duration && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-5 h-5" />
                <span>Duration: {event.event_duration}</span>
              </div>
            )}
            {event.expected_participants && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">👥</span>
                <span>Expected: {event.expected_participants} participants</span>
              </div>
            )}
            {event.guest_name && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">🎤</span>
                <span>Guest: {event.guest_name}</span>
              </div>
            )}
            {event.registration_fee && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">🎟️</span>
                <span>Fee: {event.registration_fee}</span>
              </div>
            )}
            {event.prize && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">🏆</span>
                <span>Prize: {event.prize}</span>
              </div>
            )}
            {event.budget && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-lg">💰</span>
                <span>Budget: ₹{event.budget.toLocaleString()}</span>
              </div>
            )}
          </div>

          <EventApprovalTrail event={event} className="mt-6 mb-2" />

          <div className="mt-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Overall progress</span>
              <span className="text-sm font-bold text-gray-900">{overallProgress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{completedTasks}/{totalTasks} tasks done</p>
          </div>
        </div>

        {/* Event Report */}
        <EventReport
          event={event}
          tasks={tasks}
          eventPhotos={eventPhotos}
          canEdit={isEC || isFaculty || isEditorial}
        />

        {/* Tasks */}
        <div className="premium-panel rounded-2xl p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Tasks</h3>
              <p className="text-sm text-gray-600 mt-1">
                {completedTasks} of {totalTasks} approved tasks completed
                {pendingECApprovalCount > 0 && isEC && (
                  <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                    {pendingECApprovalCount} pending your approval
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Pending EC Approval Section */}
          {isEC && tasks.filter(t => t.status === 'pending_ec_approval').length > 0 && (
            <div className="mb-8 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
              <h4 className="text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Tasks Awaiting EC Approval ({tasks.filter(t => t.status === 'pending_ec_approval').length})
              </h4>
              <p className="text-sm text-yellow-800 mb-4">
                These tasks have been proposed by committee members and are waiting for your approval before being assigned.
              </p>
              <div className="space-y-4">
                {tasks.filter(t => t.status === 'pending_ec_approval').map((task) => {
                  const isEditing = editingTask === task.id;

                  return (
                    <div key={task.id} className="bg-white border-2 border-yellow-300 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedTaskData.title || task.title}
                              onChange={(e) => setEditedTaskData({ ...editedTaskData, title: e.target.value })}
                              className="w-full font-bold text-gray-900 border border-gray-300 rounded px-3 py-2 mb-2"
                              placeholder="Task title"
                            />
                          ) : (
                            <h5 className="font-bold text-gray-900 text-lg">{task.title}</h5>
                          )}
                          <p className="text-sm text-gray-600 mt-1">
                            Assigned to: <span className="font-semibold">{task.assigned_to?.name}</span>
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                          PENDING APPROVAL
                        </span>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editedTaskData.description || task.description || ''}
                          onChange={(e) => setEditedTaskData({ ...editedTaskData, description: e.target.value })}
                          className="w-full text-gray-700 text-sm mb-3 border border-gray-300 rounded px-3 py-2"
                          rows={3}
                          placeholder="Task description"
                        />
                      ) : (
                        task.description && (
                          <p className="text-gray-700 text-sm mb-3 bg-gray-50 p-3 rounded">{task.description}</p>
                        )
                      )}

                      <TaskSupportingDocuments docs={task.task_documents} />

                      {/* Deadline picker - shown for EC during approval */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Set Deadline</label>
                        <input
                          type="datetime-local"
                          value={editedTaskData.deadline || ''}
                          onChange={(e) => setEditedTaskData({ ...editedTaskData, deadline: e.target.value })}
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full max-w-xs"
                        />
                      </div>

                      {/* EC Approval Actions */}
                      <div className="mt-4 flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => editAndApproveTask(task.id)}
                              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                            >
                              <Check className="w-4 h-4" />
                              Save & Approve
                            </button>
                            <button
                              onClick={() => {
                                setEditingTask(null);
                                setEditedTaskData({});
                              }}
                              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => approveTask(task.id)}
                              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                            >
                              <Check className="w-4 h-4" />
                              Approve Task
                            </button>
                            <button
                              onClick={() => {
                                setEditingTask(task.id);
                                setEditedTaskData({
                                  title: task.title,
                                  description: task.description,
                                  deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '',
                                });
                              }}
                              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                            >
                              <Edit className="w-4 h-4" />
                              Edit & Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Approved/Active Tasks Section */}
          {approvedTasks.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Active Tasks</h4>
              {approvedTasks.map((task) => {
                const isOpen = openTaskId === task.id;
                const updates = [...(task.updates || [])].sort(
                  (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                );
                const docs = task.task_documents || [];
                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-4 transition ${isOpen ? 'border-indigo-400 bg-indigo-50/40 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenTaskId(isOpen ? null : task.id)}
                      className="w-full text-left"
                    >
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900">{task.title}</h4>
                          <p className="text-sm text-gray-600">{task.assigned_to?.name || task.assigned_committee?.name}</p>
                          {task.ec_approved_by && task.ec_approved_at && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Approved by {task.approver?.name} on {formatPortalDate(task.ec_approved_at)}
                            </p>
                          )}
                          {task.deadline && (
                            <p className={`text-xs mt-1 font-medium ${new Date(task.deadline) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                              📅 Deadline: {formatPortalDate(task.deadline)}
                              {new Date(task.deadline) < new Date() && ' (Overdue)'}
                            </p>
                          )}
                          {!task.deadline && task.ec_approved_at && (
                            <p className={`text-xs mt-1 font-medium ${new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                              📅 Deadline: {formatPortalDate(new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000))} (default)
                              {new Date(new Date(task.ec_approved_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() && ' (Overdue)'}
                            </p>
                          )}
                          {!task.deadline && !task.ec_approved_at && task.created_at && (
                            <p className={`text-xs mt-1 font-medium ${new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                              📅 Deadline: {formatPortalDate(new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000))} (default)
                              {new Date(new Date(task.created_at).getTime() + 2 * 24 * 60 * 60 * 1000) < new Date() && ' (Overdue)'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {task.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {task.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <div className="flex gap-3 text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{updates.length} update{updates.length === 1 ? '' : 's'}</span>
                        <span className="inline-flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />{docs.length} file{docs.length === 1 ? '' : 's'}</span>
                        <span className="ml-auto text-indigo-600 font-semibold">{isOpen ? 'Hide' : 'View updates'}</span>
                      </div>
                    </button>

                    {task.description && (
                      <p className="text-gray-700 text-sm mt-3">{task.description}</p>
                    )}

                    {task.progress !== undefined && task.progress !== null && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span className="font-bold">{task.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-teal-400 transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {isOpen && (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-2">Step-by-step updates</h5>
                          {updates.length === 0 ? (
                            <p className="text-sm text-gray-500">No updates posted yet.</p>
                          ) : (
                            <ol className="space-y-3">
                              {updates.map((update: any, step: number) => (
                                <li key={update.id} className="flex gap-3">
                                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                                    {step + 1}
                                  </span>
                                  <div className="min-w-0 flex-1 rounded-xl bg-white border border-slate-100 p-3">
                                    <LinkedText text={update.update_text || ''} className="text-sm text-gray-800" />
                                    <p className="text-xs text-gray-500 mt-1">
                                      {update.user?.name || 'Member'} · {formatPortalDateTime(update.created_at)}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 mb-2">Documents</h5>
                          {docs.length === 0 ? (
                            <p className="text-sm text-gray-500">No files attached.</p>
                          ) : (
                            <TaskSupportingDocuments docs={docs} />
                          )}
                        </div>
                      </div>
                    )}

                    {task.status !== 'completed' && (
                      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <StatusIndicator entityType="task" timestamp={task.deadline} currentStatus={task.status} />
                        <ReminderButton entityId={task.id} entityType="task" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !isEC || tasks.filter(t => t.status === 'pending_ec_approval').length === 0 ? (
              <p className="text-gray-600 text-center py-8">No tasks assigned yet</p>
            ) : null
          )}
        </div>
          </>
        )}

        {activeTab === 'participants' && (
          <div className="premium-panel rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" /> Participant Details
            </h3>
            {!participantsLoading && (
              <EventParticipantEmailPanel
                eventId={event.id}
                eventTitle={event.title}
                participants={participants}
                canSend={canEditEventMeta}
              />
            )}
            {participantsLoading ? (
              <p className="text-gray-500">Loading participants...</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="max-h-[640px] overflow-y-auto pr-2">
                  <EventParticipantManager
                    eventId={event.id}
                    participants={participants}
                    canManage={canManageParticipants}
                    onRefresh={loadParticipants}
                    selectedParticipantId={selectedParticipant?.id}
                    onSelectParticipant={setSelectedParticipant}
                  />
                </div>
                <div className="rounded-xl border border-gray-200 bg-white/70 p-4 min-h-[240px]">
                  {selectedParticipant ? (
                    <>
                      {registrationSourceLabel(selectedParticipant.registration_source) &&
                        selectedParticipant.registration_source !== 'bulk_import' && (
                        <p className="text-xs font-medium text-violet-800 mb-2">
                          {registrationSourceLabel(selectedParticipant.registration_source)}
                          {selectedParticipant.registration_source === 'on_site' ? ' — marked present on submit.' : '.'}
                        </p>
                      )}
                      <h4 className="font-semibold text-gray-900 mb-1">{selectedParticipant.participant_name}</h4>
                      {participantSecondaryText(selectedParticipant.participant_email) ? (
                        <p className="text-sm text-gray-500 mb-3">
                          {participantSecondaryText(selectedParticipant.participant_email)}
                        </p>
                      ) : (
                        <div className="mb-3" />
                      )}
                      {participantDisplayGroup(selectedParticipant) !== 'Unassigned' && (
                        <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 mb-3">
                          {participantDisplayGroup(selectedParticipant)}
                        </span>
                      )}
                      {Object.keys(sanitizeParticipantFormData(selectedParticipant.form_data || {}) || {}).length > 0 ? (
                        <>
                          <h4 className="font-semibold text-gray-900 mb-2">Form details</h4>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                            {JSON.stringify(sanitizeParticipantFormData(selectedParticipant.form_data || {}), null, 2)}
                          </pre>
                        </>
                      ) : isManualParticipantSource(selectedParticipant.registration_source) ? null : (
                        <p className="text-sm text-gray-500">No additional form responses for this participant.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Select a participant to view details.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="premium-panel rounded-2xl p-8">
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <QrCode className="w-6 h-6" /> Participation / Attendance
              </h3>
              <button type="button" onClick={createEventQr} className="btn-gradient-purple px-4 py-2 rounded-xl text-sm font-semibold">
                Generate on-spot registration QR
              </button>
            </div>
            {eventQrImage && (
              <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50/70 p-4 max-w-md">
                <p className="text-xs font-semibold text-violet-900 mb-2">On-spot registration (at the venue)</p>
                <img src={eventQrImage} alt="On-spot registration QR" className="w-56 h-56 mx-auto rounded-lg bg-white p-2 border border-violet-100" />
                <p className="text-xs text-violet-800 mt-2 text-center">
                  Scanning opens your <strong>event registration form</strong>. After they submit, they appear under participants as <strong>on-site registration</strong> and are marked <strong>present</strong>. No sign-in required for guests.
                </p>
              </div>
            )}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white/70 p-4">
              <p className="text-xs text-gray-600 mb-3">
                <strong>Already registered online?</strong> They can show their <strong>personal check-in QR</strong> from their confirmation screen. Scan below or paste the QR JSON.
              </p>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-800">Scan participant check-in QR</p>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                >
                  Scan QR (Camera)
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Paste QR contents (JSON) if not using camera"
                  className="flex-1 min-w-0 w-full sm:min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button type="button" onClick={handleScan} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                  Mark present
                </button>
              </div>
            </div>
            {participantsLoading ? (
              <p className="text-gray-500">Loading participants...</p>
            ) : (
              <EventParticipantManager
                eventId={event.id}
                participants={participants}
                canManage={canManageParticipants}
                onRefresh={loadParticipants}
                mode="attendance"
                showAttendanceActions
                onMarkAttendance={(participantId, status) => {
                  void markAttendance(participantId, status);
                }}
                markingId={markingAttendanceId}
                onResetAttendance={resetAttendance}
                resettingAttendance={resettingAttendance}
              />
            )}
          </div>
        )}
      </div>
      <EventQrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleQrScanned}
        continuous
      />
    </div>
  );
}
