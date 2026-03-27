'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Download, Save, Loader2, Plus, Eye, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';

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

    const loadParticipantsForReport = useCallback(async () => {
        const { data } = await supabase
            .from('event_participants')
            .select('participant_name, participant_email, attendance_status, submitted_at')
            .eq('event_id', event.id)
            .order('submitted_at', { ascending: true });
        setParticipantsForReport(data || []);
    }, [event.id, supabase]);

    useEffect(() => {
        if (includeParticipants) {
            void loadParticipantsForReport();
        }
    }, [includeParticipants, loadParticipantsForReport]);

    function generateReportContent() {
        const posterUrl = event.poster_url
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
            event_date: event.event_date ? new Date(event.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBA',
            duration: event.event_duration || 'N/A',
            proposed_by: event.created_by_profile?.name || 'N/A',
            guest_name: event.guest_name || null,
            expected_participants: event.expected_participants || null,
            registration_fee: event.registration_fee || null,
            prize: event.prize || null,
            budget: event.budget ? `₹${event.budget.toLocaleString()}` : 'N/A',
            status: event.status?.replace(/_/g, ' ').toUpperCase() || 'N/A',
            include_participants: includeParticipants,
            include_participants_count: includeParticipantsCount,
            participants_count: includeParticipantsCount ? (participantsForReport || []).length : null,
            participants: includeParticipants
                ? (participantsForReport || []).map((p: any, idx: number) => ({
                    serial: idx + 1,
                    name: p.participant_name || 'Participant',
                    email: p.participant_email || '-',
                    attendance: (p.attendance_status || 'registered').toUpperCase(),
                    submitted_at: p.submitted_at ? new Date(p.submitted_at).toLocaleString('en-IN') : '-',
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

            const content = generateReportContent();

            const { error } = await supabase.from('event_reports').insert({
                event_id: event.id,
                report_content: JSON.stringify(content),
                additional_notes: additionalNotes.trim() || null,
                created_by: userId,
            });
            if (error) throw error;

            // Mark event as completed
            await supabase.from('events').update({ status: 'completed' }).eq('id', event.id);

            // Also save to editorial committee documents
            const { data: editComm } = await supabase.from('committees').select('id').ilike('name', '%editorial%').single();
            if (editComm) {
                await supabase.from('documents').insert({
                    title: `Event Report: ${event.title}`,
                    file_url: '',
                    file_type: 'event_report',
                    document_type: 'event_report',
                    committee_id: editComm.id,
                    uploaded_by: userId,
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    metadata: { event_id: event.id, event_title: event.title },
                });
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
            const content = generateReportContent();
            const { error } = await supabase.from('event_reports').update({
                report_content: JSON.stringify(content),
                additional_notes: additionalNotes.trim() || null,
            }).eq('id', report.id);
            if (error) throw error;
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
        const text = `EVENT REPORT
${'='.repeat(50)}

Event Name: ${data.event_name}
Committee: ${data.committee}
Date: ${data.event_date}
Venue: ${data.venue}
Proposed By: ${data.proposed_by}
Status: ${data.status}

DESCRIPTION
${'-'.repeat(30)}
${data.description}
${data.guest_name ? `\nGuest Speaker: ${data.guest_name}` : ''}
${data.registration_fee ? `\nRegistration Fee: ${data.registration_fee}` : ''}
${data.prize ? `\nPrize: ${data.prize}` : ''}
${data.expected_participants ? `\nExpected Participants: ${data.expected_participants}` : ''}
${data.include_participants_count ? `\nParticipants Count: ${data.participants_count ?? 0}` : ''}
${hasImages ? `\nPOSTER & EVENT PHOTOS\n${'-'.repeat(30)}\nThe event poster and gallery photos are shown as images in the portal (View report) and embedded in the PDF download — not as plain-text links.\n` : ''}
${data.include_participants ? `\n\nPARTICIPANTS\n${'-'.repeat(30)}\n${(data.participants || []).map((p: any) => `${p.serial}. ${p.name} | ${p.email} | ${p.attendance}`).join('\n') || 'No participants found.'}` : ''}
${report.additional_notes ? `\nADDITIONAL NOTES\n${'-'.repeat(30)}\n${report.additional_notes}` : ''}

${'='.repeat(50)}
Report generated on ${new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
IIChE AVVU Student Chapter`;

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Event_Report_${data.event_name.replace(/\s+/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded!');
    }

    function buildPlainText(data: any) {
        const hasImages = !!(data.poster_url || (Array.isArray(data.event_photo_urls) && data.event_photo_urls.length > 0));
        return `EVENT REPORT
${'='.repeat(50)}

Event Name: ${data.event_name}
Committee: ${data.committee}
Date: ${data.event_date}
Venue: ${data.venue}
Proposed By: ${data.proposed_by}
Status: ${data.status}

DESCRIPTION
${'-'.repeat(30)}
${data.description}
${data.guest_name ? `\nGuest Speaker: ${data.guest_name}` : ''}
${data.registration_fee ? `\nRegistration Fee: ${data.registration_fee}` : ''}
${data.prize ? `\nPrize: ${data.prize}` : ''}
${data.expected_participants ? `\nExpected Participants: ${data.expected_participants}` : ''}
${data.include_participants_count ? `\nParticipants Count: ${data.participants_count ?? 0}` : ''}
${hasImages ? `\nPOSTER & EVENT PHOTOS\n${'-'.repeat(30)}\n(See following pages in PDF for embedded images.)\n` : ''}
${data.include_participants ? `\n\nPARTICIPANTS\n${'-'.repeat(30)}\n${(data.participants || []).map((p: any) => `${p.serial}. ${p.name} | ${p.email} | ${p.attendance}`).join('\n') || 'No participants found.'}` : ''}
${report.additional_notes ? `\nADDITIONAL NOTES\n${'-'.repeat(30)}\n${report.additional_notes}` : ''}

${'='.repeat(50)}
Report generated on ${new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
IIChE AVVU Student Chapter`;
    }

    async function downloadAsPDF() {
        const data = getReportData();
        if (!data || !report) return;
        const tid = toast.loading('Building PDF with images…');
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const margin = 40;
            const pageW = doc.internal.pageSize.getWidth();
            const maxW = pageW - margin * 2;
            let y = 40;

            const text = buildPlainText(data);
            const lines = doc.splitTextToSize(text, maxW);
            for (const line of lines) {
                if (y > 780) {
                    doc.addPage();
                    y = 40;
                }
                doc.text(line, margin, y);
                y += 14;
            }

            const posterDisplayUrl = data.poster_url
                ? resolveStorageUrl(supabase, data.poster_url, 'event-documents')
                : '';
            if (posterDisplayUrl) {
                const img = await loadImageForPdf(posterDisplayUrl);
                if (img) {
                    try {
                        if (y > 700) {
                            doc.addPage();
                            y = 40;
                        }
                        doc.setFontSize(11);
                        doc.setTextColor(40, 40, 40);
                        doc.text('Event poster', margin, y);
                        y += 18;
                        const targetH = Math.min((img.height * maxW) / img.width, 420);
                        const targetW = (img.width * targetH) / img.height;
                        if (y + targetH > 820) {
                            doc.addPage();
                            y = 40;
                        }
                        doc.addImage(img.dataUrl, img.format, margin, y, targetW, targetH);
                        y += targetH + 24;
                    } catch (imgErr) {
                        console.warn('PDF poster embed failed', imgErr);
                    }
                }
            }

            const photoList = Array.isArray(data.event_photo_urls) ? data.event_photo_urls : [];
            const photoCap = 30;
            if (photoList.length > 0) {
                if (y > 720) {
                    doc.addPage();
                    y = 40;
                }
                doc.setFontSize(11);
                doc.text(`Event photos${photoList.length > photoCap ? ` (first ${photoCap} of ${photoList.length})` : ''}`, margin, y);
                y += 20;
                for (let i = 0; i < Math.min(photoList.length, photoCap); i++) {
                    const raw = photoList[i];
                    const url = resolveStorageUrl(supabase, raw, 'event-photos');
                    const img = await loadImageForPdf(url);
                    if (!img) continue;
                    try {
                        const targetH = Math.min((img.height * maxW) / img.width, 280);
                        const targetW = (img.width * targetH) / img.height;
                        if (y + targetH > 820) {
                            doc.addPage();
                            y = 40;
                        }
                        doc.addImage(img.dataUrl, img.format, margin, y, targetW, targetH);
                        y += targetH + 16;
                    } catch (imgErr) {
                        console.warn('PDF photo embed failed', imgErr);
                    }
                }
            }

            doc.save(`Event_Report_${data.event_name.replace(/\s+/g, '_')}.pdf`);
            toast.success('Report downloaded as PDF', { id: tid });
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Could not build PDF', { id: tid });
        }
    }

    if (loading) return null;

    const reportData = report ? getReportData() : null;

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
                        <div><span className="font-semibold text-gray-500">Status:</span> <span className="text-gray-800">{reportData.status}</span></div>
                        {reportData.expected_participants && <div><span className="font-semibold text-gray-500">Expected Participants:</span> <span className="text-gray-800">{reportData.expected_participants}</span></div>}
                        {reportData.include_participants_count && <div><span className="font-semibold text-gray-500">Participants Count:</span> <span className="text-gray-800">{reportData.participants_count ?? 0}</span></div>}
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
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Attendance</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Submitted At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(reportData.participants || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-3 text-center text-gray-500">No participants found.</td>
                                            </tr>
                                        ) : (
                                            (reportData.participants || []).map((p: any) => (
                                                <tr key={`participant-row-${p.serial}`} className="border-t border-gray-100">
                                                    <td className="px-3 py-2 text-gray-700">{p.serial}</td>
                                                    <td className="px-3 py-2 text-gray-800 font-medium">{p.name}</td>
                                                    <td className="px-3 py-2 text-gray-700">{p.email}</td>
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
                        Report created on {new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            )}

            {!report && !editing && (
                <p className="text-sm text-gray-400">No report created yet.{canEdit ? ' Click "Create Report" to auto-generate one.' : ''}</p>
            )}

            {report && !showReport && (
                <p className="text-sm text-gray-500">Report available. Click "View" to see it or download as TXT/PDF.</p>
            )}
        </div>
    );
}
