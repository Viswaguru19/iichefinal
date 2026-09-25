'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Download, Save, Loader2, Plus, Eye, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  escapeHtml,
  wordHtmlDocument,
  FORMAL_ORG_LINE,
  FORMAL_CHAPTER_LINE,
} from '@/lib/formal-doc-export';
import { participantGroupLabel } from '@/lib/event-participant-groups';
import { notifyCommittee } from '@/lib/portal-notify-helpers';
import { upsertEditorialEventReportDocument } from '@/lib/editorial-event-document';
import { formatPortalDate, formatPortalDateTime } from '@/lib/portal-date';

interface EventReportProps {
    event: any;
    tasks: any[];
    eventPhotos?: any[];
    canEdit: boolean; // EC, faculty, editorial
}

function resolveStorageUrl(
    supabase: ReturnType<typeof createClient>,
    pathOrUrl: string | null | undefined,
    bucket: 'event-documents' | 'event-photos',
): string {
    if (!pathOrUrl) return '';
    const s = String(pathOrUrl).trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return supabase.storage.from(bucket).getPublicUrl(s).data.publicUrl;
}

/** Fetch image for jsPDF addImage (CORS must allow storage origin). */
async function loadImageForPdf(url: string): Promise<{ dataUrl: string; format: string; width: number; height: number } | null> {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.onerror = () => reject(new Error('read'));
            r.readAsDataURL(blob);
        });
        const mime = (blob.type || '').toLowerCase();
        let format = 'JPEG';
        if (mime.includes('png')) format = 'PNG';
        else if (mime.includes('webp')) format = 'WEBP';
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
            const image = new window.Image();
            image.onload = () => resolve({ w: image.naturalWidth, h: image.naturalHeight });
            image.onerror = () => reject(new Error('decode'));
            image.src = dataUrl;
        });
        return { dataUrl, format, width: dims.w, height: dims.h };
    } catch {
        return null;
    }
}

export default function EventReport({ event, tasks, eventPhotos = [], canEdit }: EventReportProps) {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [includeParticipants, setIncludeParticipants] = useState(false);
    const [includeParticipantsCount, setIncludeParticipantsCount] = useState(false);
    const [participantsForReport, setParticipantsForReport] = useState<any[]>([]);
    const [showReport, setShowReport] = useState(false);
    const [computedExpense, setComputedExpense] = useState<number | null>(null);
    const [liveParticipantsForView, setLiveParticipantsForView] = useState<any[]>([]);
    const supabase = createClient();

    const loadReport = useCallback(async () => {
        const { data } = await supabase
            .from('event_reports')
            .select('*')
            .eq('event_id', event.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        setReport(data);
        if (data) setAdditionalNotes(data.additional_notes || '');
        const parsed = data?.report_content && (typeof data.report_content === 'string' ? JSON.parse(data.report_content) : data.report_content);
        setIncludeParticipants(!!parsed?.include_participants);
        setIncludeParticipantsCount(!!parsed?.include_participants_count);
        setLoading(false);
    }, [event.id, supabase]);

    useEffect(() => { loadReport(); }, [loadReport]);

    useEffect(() => {
        async function loadComputedExpense() {
            const eventName = String(event?.title || '').trim();
            if (!eventName) {
                setComputedExpense(null);
                return;
            }
            // Finance records store event name in statement_of_accounts.event.
            const { data, error } = await supabase
                .from('statement_of_accounts')
                .select('debit')
                .eq('event', eventName);
            if (error) {
                setComputedExpense(null);
                return;
            }
            const total = (data || []).reduce((sum: number, row: any) => sum + (Number(row.debit) || 0), 0);
            setComputedExpense(total > 0 ? total : null);
        }
        void loadComputedExpense();
    }, [event?.title, supabase]);

    const loadParticipantsForReport = useCallback(async () => {
        const { data } = await supabase
            .from('event_participants')
            .select('participant_name, participant_email, participant_group, attendance_status, created_at')
            .eq('event_id', event.id)
            .order('created_at', { ascending: true });
        setParticipantsForReport(data || []);
    }, [event.id, supabase]);

    useEffect(() => {
        if (includeParticipants) {
            void loadParticipantsForReport();
        }
    }, [includeParticipants, loadParticipantsForReport]);

    async function getParticipantsSnapshot() {
        if (!includeParticipants) return [] as any[];
        const { data, error } = await supabase
            .from('event_participants')
            .select('participant_name, participant_email, participant_group, attendance_status, created_at')
            .eq('event_id', event.id)
            .order('created_at', { ascending: true });
        if (error) return participantsForReport || [];
        return data || [];
    }

    useEffect(() => {
        async function loadLiveParticipantsForView() {
            if (!showReport) return;
            const rows = await getParticipantsSnapshot();
            setLiveParticipantsForView(
                (rows || []).map((p: any, idx: number) => ({
                    serial: idx + 1,
                    name: p.participant_name || 'Participant',
                    email: p.participant_email || '-',
                    group: participantGroupLabel(p.participant_group),
                    attendance: (p.attendance_status || 'registered').toUpperCase(),
                    submitted_at: p.created_at ? formatPortalDateTime(p.created_at) : '-',
                })),
            );
        }
        void loadLiveParticipantsForView();
    }, [showReport, event.id]);

    function generateReportContent(participantRows: any[] = participantsForReport) {
        const rawEventBudget = Number(event?.budget);
        const resolvedBudget = Number.isFinite(rawEventBudget) ? rawEventBudget : null;
        const posterApproved =
            event.poster_status === 'approved' ||
            (event.poster_url && (event.poster_status == null || event.poster_status === ''));
        const posterUrl =
            posterApproved && event.poster_url
                ? resolveStorageUrl(supabase, event.poster_url, 'event-documents') || null
                : null;
        const photoUrls = (eventPhotos || [])
            .map((p: any) => resolveStorageUrl(supabase, p.photo_url, 'event-photos'))
            .filter(Boolean);

        return {
            event_name: event.title,
            committee: event.committees?.name || 'N/A',
            description: event.description || '',
            venue: event.location || 'N/A',
            event_date: event.event_date ? formatPortalDate(event.event_date) : 'TBA',
            duration: event.event_duration || 'N/A',
            proposed_by: event.created_by_profile?.name || 'N/A',
            guest_name: event.guest_name || null,
            expected_participants: event.expected_participants || null,
            registration_fee: event.registration_fee || null,
            prize: event.prize || null,
            budget: resolvedBudget != null ? `₹${resolvedBudget.toLocaleString('en-IN')}` : 'N/A',
            actual_expense: computedExpense != null ? `₹${computedExpense.toLocaleString('en-IN')}` : 'N/A',
            status: event.status?.replace(/_/g, ' ').toUpperCase() || 'N/A',
            include_participants: includeParticipants,
            include_participants_count: includeParticipantsCount,
            participants_count: includeParticipantsCount ? (participantRows || []).length : null,
            participants: includeParticipants
                ? (participantRows || []).map((p: any, idx: number) => ({
                    serial: idx + 1,
                    name: p.participant_name || 'Participant',
                    email: p.participant_email || '-',
                    group: participantGroupLabel(p.participant_group),
                    attendance: (p.attendance_status || 'registered').toUpperCase(),
                    submitted_at: p.created_at ? formatPortalDateTime(p.created_at) : '-',
                }))
                : [],
            poster_url: posterUrl,
            event_photo_urls: photoUrls,
        };
    }

    async function createReport() {
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                // Fallback: try getUser
                const { data: { user: u2 } } = await supabase.auth.getUser();
                if (!u2) { toast.error('Please log in again'); setSaving(false); return; }
            }
            const userId = session?.user?.id || (await supabase.auth.getUser()).data.user?.id;
            if (!userId) { toast.error('Please log in again'); setSaving(false); return; }

            const participantRows = await getParticipantsSnapshot();
            setParticipantsForReport(participantRows);
            const content = generateReportContent(participantRows);

            const { error } = await supabase.from('event_reports').insert({
                event_id: event.id,
                report_content: JSON.stringify(content),
                additional_notes: additionalNotes.trim() || null,
                created_by: userId,
            });
            if (error) throw error;

            // Mark event as completed
            await supabase.from('events').update({ status: 'completed' }).eq('id', event.id);

            // Save / refresh Editorial Committee document (title = event name)
            const docRes = await upsertEditorialEventReportDocument(supabase, {
                eventId: event.id,
                eventTitle: event.title,
                uploadedBy: userId,
            });
            if (!docRes.ok) {
                console.warn('Editorial document upsert failed:', docRes.error);
            } else {
                const { data: editComm } = await supabase
                    .from('committees')
                    .select('id')
                    .ilike('name', '%editorial%')
                    .limit(1)
                    .maybeSingle();
                if (editComm?.id) {
                    await notifyCommittee(supabase, editComm.id, {
                        type: 'event_report',
                        title: 'Event report created',
                        message: `Report for "${event.title}" was submitted.`,
                        link: `/dashboard/event-detail/${event.id}`,
                        related_id: event.id,
                    });
                }
            }

            toast.success('Event report created!');
            setEditing(false);
            loadReport();
        } catch (err: any) {
            toast.error(err.message || 'Failed to create report');
        } finally {
            setSaving(false);
        }
    }

    async function updateReport() {
        if (!report) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const participantRows = await getParticipantsSnapshot();
            setParticipantsForReport(participantRows);
            const content = generateReportContent(participantRows);
            const { error } = await supabase.from('event_reports').update({
                report_content: JSON.stringify(content),
                additional_notes: additionalNotes.trim() || null,
            }).eq('id', report.id);
            if (error) throw error;

            if (user?.id) {
                const docRes = await upsertEditorialEventReportDocument(supabase, {
                    eventId: event.id,
                    eventTitle: event.title,
                    uploadedBy: user.id,
                });
                if (!docRes.ok) console.warn('Editorial document upsert failed:', docRes.error);
            }

            toast.success('Report updated!');
            setEditing(false);
            loadReport();
        } catch (err: any) {
            toast.error(err.message || 'Failed to update report');
        } finally {
            setSaving(false);
        }
    }

    function getReportData(): any {
        if (!report?.report_content) return null;
        try { return typeof report.report_content === 'string' ? JSON.parse(report.report_content) : report.report_content; }
        catch { return null; }
    }

    function downloadAsText() {
        const data = getReportData();
        if (!data) return;
        const hasImages = !!(data.poster_url || (Array.isArray(data.event_photo_urls) && data.event_photo_urls.length > 0));
        const text = `${FORMAL_ORG_LINE}
${FORMAL_CHAPTER_LINE}

OFFICIAL EVENT REPORT
${'═'.repeat(56)}

1. EVENT SUMMARY
${'─'.repeat(56)}
Event title:        ${data.event_name}
Organizing committee: ${data.committee}
Date:               ${data.event_date}
Venue:              ${data.venue}
Duration:           ${data.duration}
Proposed by:        ${data.proposed_by}
Budget:             ${data.budget}
Actual expense:     ${data.actual_expense || 'N/A'}
Status:             ${data.status}
${data.guest_name ? `Guest / speaker:     ${data.guest_name}` : ''}
${data.registration_fee ? `Registration fee:   ${data.registration_fee}` : ''}
${data.prize ? `Prize:              ${data.prize}` : ''}
${data.expected_participants ? `Expected attendance: ${data.expected_participants}` : ''}
${data.include_participants_count ? `Registered count:   ${data.participants_count ?? 0}` : ''}

2. DESCRIPTION
${'─'.repeat(56)}
${data.description || '—'}

${hasImages ? `3. VISUAL RECORDS\n${'─'.repeat(56)}\nOfficial poster and event photographs are embedded in the PDF / Word export and displayed in the portal.\n` : ''}
${data.include_participants ? `\n4. PARTICIPANT REGISTER\n${'─'.repeat(56)}\n${(data.participants || []).map((p: any) => `  ${p.serial}. ${p.name}  |  ${p.email}  |  ${p.group}  |  ${p.attendance}`).join('\n') || '  (No records.)'}\n` : ''}
${report.additional_notes ? `\n5. ADDITIONAL REMARKS\n${'─'.repeat(56)}\n${report.additional_notes}\n` : ''}

${'═'.repeat(56)}
Document prepared: ${formatPortalDate(report.created_at)}
This document is generated from the IIChE AVVU Student Chapter portal.`;

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Event_Report_${data.event_name.replace(/\s+/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded!');
    }

    async function downloadAsWord() {
        const data = getReportData();
        if (!data || !report) return;
        const tid = toast.loading('Building Word document…');
        try {
            const posterUrl = data.poster_url ? resolveStorageUrl(supabase, data.poster_url, 'event-documents') : '';
            const photoUrls = (Array.isArray(data.event_photo_urls) ? data.event_photo_urls : []).map((raw: string) =>
                resolveStorageUrl(supabase, raw, 'event-photos'),
            );

            const metaRows: [string, string][] = [
                ['Event title', data.event_name],
                ['Committee', data.committee],
                ['Date', data.event_date],
                ['Venue', data.venue],
                ['Duration', String(data.duration)],
                ['Proposed by', data.proposed_by],
                ['Budget', data.budget],
                ['Actual expense', data.actual_expense || 'N/A'],
                ['Status', data.status],
            ];
            if (data.guest_name) metaRows.push(['Guest / speaker', String(data.guest_name)]);
            if (data.registration_fee) metaRows.push(['Registration fee', String(data.registration_fee)]);
            if (data.prize) metaRows.push(['Prize', String(data.prize)]);
            if (data.expected_participants) metaRows.push(['Expected participants', String(data.expected_participants)]);
            if (data.include_participants_count) metaRows.push(['Registered count', String(data.participants_count ?? 0)]);

            let participantTable = '';
            if (data.include_participants && (data.participants || []).length > 0) {
                const rows = (data.participants as any[])
                    .map(
                        (p) =>
                            `<tr><td>${escapeHtml(String(p.serial))}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.email)}</td><td>${escapeHtml(p.group)}</td><td>${escapeHtml(p.attendance)}</td><td>${escapeHtml(p.submitted_at || '—')}</td></tr>`,
                    )
                    .join('');
                participantTable = `<p class="section">Participant register</p><table class="grid"><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Group</th><th>Attendance</th><th>Submitted</th></tr></thead><tbody>${rows}</tbody></table>`;
            } else if (data.include_participants) {
                participantTable = `<p class="section">Participant register</p><p class="body-text">No participant records on file.</p>`;
            }

            let figures = '';
            if (posterUrl) {
                figures += `<p class="section">Official event poster</p><div class="img-block"><img src="${escapeHtml(posterUrl)}" alt="Event poster"/></div><p class="figure-cap">Figure 1 — Approved event poster.</p>`;
            }
            photoUrls.forEach((u: string, i: number) => {
                figures += `<p class="section">Event photograph ${i + 1}</p><div class="img-block"><img src="${escapeHtml(u)}" alt="Event photo ${i + 1}"/></div><p class="figure-cap">Figure ${(posterUrl ? 2 : 1) + i} — On-site documentation.</p>`;
            });

            const inner = `
<div class="rule"></div>
<p class="org">${escapeHtml(FORMAL_ORG_LINE)}<br/>${escapeHtml(FORMAL_CHAPTER_LINE)}</p>
<p class="doc-title">EVENT REPORT</p>
<p class="subtitle">Official record of student chapter activity</p>
<table class="meta">
${metaRows.map(([k, v]) => `<tr><td class="lbl">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
</table>
<p class="section">Executive summary / description</p>
<p class="body-text">${escapeHtml(data.description || '—')}</p>
${participantTable}
${figures}
${report.additional_notes ? `<p class="section">Additional remarks</p><p class="body-text">${escapeHtml(report.additional_notes)}</p>` : ''}
<div class="footer">
<p>This document was generated from the chapter portal on ${escapeHtml(formatPortalDate(new Date()))}.</p>
<p>For archival use. Images require network access if opened offline.</p>
</div>`;

            const html = wordHtmlDocument(inner);
            const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Event_Report_${data.event_name.replace(/\s+/g, '_')}.doc`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Word document downloaded', { id: tid });
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Could not build document', { id: tid });
        }
    }

    async function downloadAsPDF() {
        const data = getReportData();
        if (!data || !report) return;
        const tid = toast.loading('Building formal PDF…');
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const margin = 48;
            const maxW = W - 2 * margin;
            const labelX = margin;
            const valueX = margin + 118;
            let y = margin;

            const drawTopRule = () => {
                doc.setFillColor(15, 23, 42);
                doc.rect(0, 0, W, 6, 'F');
            };

            const drawHeader = () => {
                drawTopRule();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(71, 85, 105);
                doc.text(FORMAL_ORG_LINE, margin, 24);
                doc.text(FORMAL_CHAPTER_LINE, margin, 34);
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.5);
                doc.line(margin, 42, W - margin, 42);
            };

            const newPage = () => {
                doc.addPage();
                y = margin;
                drawHeader();
                y = 56;
            };

            const need = (h: number) => {
                if (y + h > H - margin) newPage();
            };

            drawHeader();
            y = 56;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(17);
            doc.setTextColor(15, 23, 42);
            doc.text('EVENT REPORT', margin, y);
            y += 22;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 116, 139);
            doc.text('Official record — student chapter activity', margin, y);
            y += 28;

            const kv = (label: string, value: string) => {
                const v = String(value || '—');
                need(20);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(51, 65, 85);
                doc.text(label, labelX, y);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(30, 41, 55);
                const lines = doc.splitTextToSize(v, maxW - (valueX - margin));
                doc.text(lines, valueX, y);
                y += Math.max(16, lines.length * 13) + 6;
            };

            kv('Event title', data.event_name);
            kv('Committee', data.committee);
            kv('Date', data.event_date);
            kv('Venue', data.venue);
            kv('Duration', data.duration);
            kv('Proposed by', data.proposed_by);
            kv('Budget', data.budget);
            kv('Actual expense', data.actual_expense || 'N/A');
            kv('Status', data.status);
            if (data.guest_name) kv('Guest / speaker', data.guest_name);
            if (data.registration_fee) kv('Registration fee', data.registration_fee);
            if (data.prize) kv('Prize', data.prize);
            if (data.expected_participants) kv('Expected participants', data.expected_participants);
            if (data.include_participants_count) kv('Registered count', String(data.participants_count ?? 0));

            y += 8;
            need(30);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(30, 58, 138);
            doc.text('Executive summary / description', margin, y);
            y += 6;
            doc.setDrawColor(148, 163, 184);
            doc.line(margin, y, W - margin, y);
            y += 18;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(55, 65, 81);
            const descLines = doc.splitTextToSize(String(data.description || '—'), maxW);
            for (const line of descLines) {
                need(14);
                doc.text(line, margin, y);
                y += 13;
            }
            y += 12;

            if (data.include_participants) {
                need(28);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(30, 58, 138);
                doc.text('Participant register', margin, y);
                y += 6;
                doc.setDrawColor(148, 163, 184);
                doc.line(margin, y, W - margin, y);
                y += 16;
                doc.setFontSize(9);
                const participants = data.participants || [];
                if (participants.length === 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(100, 116, 139);
                    doc.text('No participant records on file.', margin, y);
                    y += 20;
                } else {
                    const col = [margin, margin + 28, margin + 150, margin + 320, margin + 400];
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(71, 85, 105);
                    doc.text('#', col[0], y);
                    doc.text('Name', col[1], y);
                    doc.text('Group', col[2], y);
                    doc.text('Attend.', col[3], y);
                    y += 14;
                    doc.setDrawColor(226, 232, 240);
                    doc.line(margin, y - 4, W - margin, y - 4);
                    doc.setFont('helvetica', 'normal');
                    for (const p of participants) {
                        const rowH = 36;
                        need(rowH);
                        doc.setTextColor(55, 65, 81);
                        doc.text(String(p.serial), col[0], y);
                        doc.text(doc.splitTextToSize(String(p.name), 95)[0] || '', col[1], y);
                        doc.text(doc.splitTextToSize(String(p.group || '—'), 70)[0] || '', col[2], y);
                        doc.text(String(p.attendance), col[3], y);
                        y += rowH;
                    }
                }
                y += 8;
            }

            if (report.additional_notes) {
                need(40);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(30, 58, 138);
                doc.text('Additional remarks', margin, y);
                y += 6;
                doc.line(margin, y, W - margin, y);
                y += 16;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(55, 65, 81);
                for (const line of doc.splitTextToSize(String(report.additional_notes), maxW)) {
                    need(14);
                    doc.text(line, margin, y);
                    y += 13;
                }
                y += 12;
            }

            const posterDisplayUrl = data.poster_url ? resolveStorageUrl(supabase, data.poster_url, 'event-documents') : '';
            if (posterDisplayUrl) {
                newPage();
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(30, 58, 138);
                doc.text('Official event poster', margin, y);
                y += 6;
                doc.setDrawColor(148, 163, 184);
                doc.line(margin, y, W - margin, y);
                y += 20;
                const img = await loadImageForPdf(posterDisplayUrl);
                if (img) {
                    const maxH = H - y - margin - 36;
                    let targetW = maxW;
                    let targetH = (img.height * targetW) / img.width;
                    if (targetH > maxH) {
                        targetH = maxH;
                        targetW = (img.width * targetH) / img.height;
                    }
                    const xImg = margin + (maxW - targetW) / 2;
                    if (y + targetH > H - margin) newPage();
                    doc.addImage(img.dataUrl, img.format, xImg, y, targetW, targetH);
                    y += targetH + 14;
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(9);
                    doc.setTextColor(71, 85, 105);
                    doc.text('Figure 1 — Approved event poster.', margin, y);
                    y += 20;
                }
            }

            const photoList = Array.isArray(data.event_photo_urls) ? data.event_photo_urls : [];
            const photoCap = 24;
            let fig = posterDisplayUrl ? 2 : 1;
            for (let i = 0; i < Math.min(photoList.length, photoCap); i++) {
                const url = resolveStorageUrl(supabase, photoList[i], 'event-photos');
                const pimg = await loadImageForPdf(url);
                if (!pimg) continue;
                newPage();
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(30, 58, 138);
                doc.text(`Event photograph ${i + 1}`, margin, y);
                y += 6;
                doc.line(margin, y, W - margin, y);
                y += 18;
                const maxH = H - y - margin - 40;
                let targetW = maxW;
                let targetH = (pimg.height * targetW) / pimg.width;
                if (targetH > maxH) {
                    targetH = maxH;
                    targetW = (pimg.width * targetH) / pimg.height;
                }
                const xImg = margin + (maxW - targetW) / 2;
                doc.addImage(pimg.dataUrl, pimg.format, xImg, y, targetW, targetH);
                y += targetH + 12;
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                doc.text(`Figure ${fig} — On-site documentation.`, margin, y);
                fig += 1;
                y += 16;
            }

            need(24);
            y += 4;
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            const footNote = `Generated ${formatPortalDate(new Date())} · ${FORMAL_ORG_LINE} · ${FORMAL_CHAPTER_LINE}`;
            for (const fl of doc.splitTextToSize(footNote, maxW)) {
                need(11);
                doc.text(fl, margin, y);
                y += 10;
            }

            doc.save(`Event_Report_${data.event_name.replace(/\s+/g, '_')}.pdf`);
            toast.success('Formal PDF downloaded', { id: tid });
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Could not build PDF', { id: tid });
        }
    }

    if (loading) return null;

    const reportData = report ? getReportData() : null;
    const savedParticipants = Array.isArray(reportData?.participants) ? reportData.participants : [];
    const participantsForDisplay =
        reportData?.include_participants
            ? (savedParticipants.length > 0 ? savedParticipants : liveParticipantsForView)
            : [];
    const participantsCountForDisplay =
        reportData?.include_participants_count
            ? (typeof reportData?.participants_count === 'number'
                ? reportData.participants_count
                : participantsForDisplay.length)
            : null;

    return (
        <div className="glass rounded-2xl p-4 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" /> Event Report
                </h3>
                <div className="flex gap-2 flex-wrap">
                    {report && (
                        <>
                            <button onClick={() => setShowReport(!showReport)}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
                                <Eye className="w-3.5 h-3.5" /> {showReport ? 'Hide' : 'View'}
                            </button>
                            <button onClick={downloadAsText}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition">
                                <Download className="w-3.5 h-3.5" /> TXT
                            </button>
                            <button onClick={downloadAsPDF}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition">
                                <Download className="w-3.5 h-3.5" /> PDF
                            </button>
                            <button onClick={downloadAsWord}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition">
                                <Download className="w-3.5 h-3.5" /> Word
                            </button>
                        </>
                    )}
                    {canEdit && !report && (
                        <button onClick={() => setEditing(true)}
                            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                            <Plus className="w-3.5 h-3.5" /> Create Report
                        </button>
                    )}
                    {canEdit && report && !editing && (
                        <button onClick={() => setEditing(true)}
                            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition">
                            <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Create / Edit form */}
            {editing && (
                <div className="bg-blue-50 rounded-xl p-4 sm:p-5 mb-4 border border-blue-200">
                    <p className="text-sm text-blue-700 mb-3">
                        Event details, poster and event photos will be auto-filled from proposal/event data. Add any additional notes below:
                    </p>
                    <label className="flex items-center gap-2 mb-3 text-sm text-blue-800 font-medium">
                        <input
                            type="checkbox"
                            checked={includeParticipants}
                            onChange={(e) => setIncludeParticipants(e.target.checked)}
                            className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        Include participants table in report
                    </label>
                    <label className="flex items-center gap-2 mb-3 text-sm text-blue-800 font-medium">
                        <input
                            type="checkbox"
                            checked={includeParticipantsCount}
                            onChange={(e) => setIncludeParticipantsCount(e.target.checked)}
                            className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        Include participants count in report
                    </label>
                    <textarea
                        value={additionalNotes}
                        onChange={e => setAdditionalNotes(e.target.value)}
                        placeholder="Add any additional observations, outcomes, highlights, or remarks..."
                        rows={4}
                        className="w-full border border-blue-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    />
                    <div className="flex gap-2 mt-3 flex-wrap">
                        <button onClick={report ? updateReport : createReport} disabled={saving}
                            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50">
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> {report ? 'Update Report' : 'Generate Report'}</>}
                        </button>
                        <button onClick={() => setEditing(false)} className="flex items-center gap-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold">
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Report display */}
            {report && showReport && reportData && (
                <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div><span className="font-semibold text-gray-500">Event:</span> <span className="text-gray-800">{reportData.event_name}</span></div>
                        <div><span className="font-semibold text-gray-500">Committee:</span> <span className="text-gray-800">{reportData.committee}</span></div>
                        <div><span className="font-semibold text-gray-500">Date:</span> <span className="text-gray-800">{reportData.event_date}</span></div>
                        <div><span className="font-semibold text-gray-500">Venue:</span> <span className="text-gray-800">{reportData.venue}</span></div>
                        <div><span className="font-semibold text-gray-500">Duration:</span> <span className="text-gray-800">{reportData.duration}</span></div>
                        <div><span className="font-semibold text-gray-500">Proposed By:</span> <span className="text-gray-800">{reportData.proposed_by}</span></div>
                        <div><span className="font-semibold text-gray-500">Budget:</span> <span className="text-gray-800">{reportData.budget}</span></div>
                        <div><span className="font-semibold text-gray-500">Actual Expense:</span> <span className="text-gray-800">{reportData.actual_expense || 'N/A'}</span></div>
                        <div><span className="font-semibold text-gray-500">Status:</span> <span className="text-gray-800">{reportData.status}</span></div>
                        {reportData.expected_participants && <div><span className="font-semibold text-gray-500">Expected Participants:</span> <span className="text-gray-800">{reportData.expected_participants}</span></div>}
                        {reportData.include_participants_count && <div><span className="font-semibold text-gray-500">Participants Count:</span> <span className="text-gray-800">{participantsCountForDisplay ?? 0}</span></div>}
                        {reportData.guest_name && <div><span className="font-semibold text-gray-500">Guest Speaker:</span> <span className="text-gray-800">{reportData.guest_name}</span></div>}
                        {reportData.registration_fee && <div><span className="font-semibold text-gray-500">Registration Fee:</span> <span className="text-gray-800">{reportData.registration_fee}</span></div>}
                        {reportData.prize && <div><span className="font-semibold text-gray-500">Prize:</span> <span className="text-gray-800">{reportData.prize}</span></div>}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-500 text-sm mb-1">Description</p>
                        <p className="text-sm text-gray-700">{reportData.description}</p>
                    </div>
                    {reportData.poster_url && (
                        <div>
                            <p className="font-semibold text-gray-500 text-sm mb-2">Event Poster</p>
                            <img
                                src={resolveStorageUrl(supabase, reportData.poster_url, 'event-documents')}
                                alt="Event poster"
                                className="w-full max-w-md rounded-lg border border-gray-200 object-contain bg-gray-50 max-h-[480px]"
                            />
                        </div>
                    )}
                    {Array.isArray(reportData.event_photo_urls) && reportData.event_photo_urls.length > 0 && (
                        <div>
                            <p className="font-semibold text-gray-500 text-sm mb-2">Event Photos</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {reportData.event_photo_urls.map((rawUrl: string, idx: number) => {
                                    const src = resolveStorageUrl(supabase, rawUrl, 'event-photos');
                                    return (
                                        <img
                                            key={`report-photo-${idx}-${rawUrl}`}
                                            src={src}
                                            alt={`Event photo ${idx + 1}`}
                                            className="w-full h-36 object-cover rounded-lg border border-gray-200"
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {reportData.include_participants && (
                        <div>
                            <p className="font-semibold text-gray-500 text-sm mb-2">Participants</p>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Email</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Group</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Attendance</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Submitted At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {participantsForDisplay.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-3 text-center text-gray-500">No participants found.</td>
                                            </tr>
                                        ) : (
                                            participantsForDisplay.map((p: any) => (
                                                <tr key={`participant-row-${p.serial}`} className="border-t border-gray-100">
                                                    <td className="px-3 py-2 text-gray-700">{p.serial}</td>
                                                    <td className="px-3 py-2 text-gray-800 font-medium">{p.name}</td>
                                                    <td className="px-3 py-2 text-gray-700">{p.email}</td>
                                                    <td className="px-3 py-2 text-gray-700">{p.group || 'Unassigned'}</td>
                                                    <td className="px-3 py-2 text-gray-700">{p.attendance}</td>
                                                    <td className="px-3 py-2 text-gray-600">{p.submitted_at || '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {report.additional_notes && (
                        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                            <p className="font-semibold text-blue-700 text-sm mb-1">Additional Notes</p>
                            <p className="text-sm text-blue-800 whitespace-pre-wrap">{report.additional_notes}</p>
                        </div>
                    )}
                    <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                        Report created on {formatPortalDate(report.created_at)}
                    </p>
                </div>
            )}

            {!report && !editing && (
                <p className="text-sm text-gray-400">No report created yet.{canEdit ? ' Click "Create Report" to auto-generate one.' : ''}</p>
            )}

            {report && !showReport && (
                <p className="text-sm text-gray-500">Report available. View on screen or download as TXT, PDF, or Word.</p>
            )}
        </div>
    );
}
