'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Download, Save, Loader2, Plus, Eye, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface EventReportProps {
    event: any;
    tasks: any[];
    canEdit: boolean; // EC, faculty, editorial
}

export default function EventReport({ event, tasks, canEdit }: EventReportProps) {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [additionalNotes, setAdditionalNotes] = useState('');
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
        setLoading(false);
    }, [event.id, supabase]);

    useEffect(() => { loadReport(); }, [loadReport]);

    function generateReportContent() {
        const approvedTasks = tasks.filter(t => t.status !== 'pending_ec_approval' && t.status !== 'rejected');
        const completedTasks = approvedTasks.filter(t => t.status === 'completed');

        const taskLines = approvedTasks.map(t =>
            `• ${t.title} — Assigned to: ${t.assigned_to?.name || 'N/A'} — Status: ${t.status.replace(/_/g, ' ')}${t.progress != null ? ` (${t.progress}%)` : ''}`
        ).join('\n');

        return {
            event_name: event.title,
            committee: event.committees?.name || 'N/A',
            description: event.description || '',
            venue: event.location || 'N/A',
            event_date: event.event_date ? new Date(event.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBA',
            proposed_by: event.created_by_profile?.name || 'N/A',
            status: event.status?.replace(/_/g, ' ').toUpperCase() || 'N/A',
            total_tasks: approvedTasks.length,
            completed_tasks: completedTasks.length,
            task_details: taskLines || 'No tasks assigned.',
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

TASKS (${data.completed_tasks}/${data.total_tasks} completed)
${'-'.repeat(30)}
${data.task_details}
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

    function downloadAsHTML() {
        const data = getReportData();
        if (!data) return;
        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Event Report - ${data.event_name}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333}
h1{color:#4338ca;border-bottom:3px solid #4338ca;padding-bottom:10px}
h2{color:#6366f1;margin-top:30px}
.meta{background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0}
.meta p{margin:6px 0}
.label{font-weight:bold;color:#374151}
.tasks{background:#fefce8;padding:16px;border-radius:8px;border-left:4px solid #eab308}
.notes{background:#eff6ff;padding:16px;border-radius:8px;border-left:4px solid #3b82f6;margin-top:20px}
.footer{margin-top:40px;padding-top:20px;border-top:2px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px}
@media print{body{margin:0;padding:20px}}
</style></head><body>
<h1>Event Report: ${data.event_name}</h1>
<div class="meta">
<p><span class="label">Committee:</span> ${data.committee}</p>
<p><span class="label">Date:</span> ${data.event_date}</p>
<p><span class="label">Venue:</span> ${data.venue}</p>
<p><span class="label">Proposed By:</span> ${data.proposed_by}</p>
<p><span class="label">Status:</span> ${data.status}</p>
</div>
<h2>Description</h2><p>${data.description}</p>
<h2>Tasks (${data.completed_tasks}/${data.total_tasks} completed)</h2>
<div class="tasks"><pre style="white-space:pre-wrap;font-family:inherit">${data.task_details}</pre></div>
${report.additional_notes ? `<div class="notes"><h2 style="margin-top:0">Additional Notes</h2><p>${report.additional_notes.replace(/\n/g, '<br>')}</p></div>` : ''}
<div class="footer">Report generated on ${new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}<br>IIChE AVVU Student Chapter</div>
</body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Event_Report_${data.event_name.replace(/\s+/g, '_')}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded as HTML (open in browser and print as PDF)!');
    }

    if (loading) return null;

    const reportData = report ? getReportData() : null;

    return (
        <div className="glass rounded-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" /> Event Report
                </h3>
                <div className="flex gap-2">
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
                            <button onClick={downloadAsHTML}
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
                <div className="bg-blue-50 rounded-xl p-5 mb-4 border border-blue-200">
                    <p className="text-sm text-blue-700 mb-3">
                        Event details, tasks, and committee info will be auto-filled from the event data. Add any additional notes below:
                    </p>
                    <textarea
                        value={additionalNotes}
                        onChange={e => setAdditionalNotes(e.target.value)}
                        placeholder="Add any additional observations, outcomes, highlights, or remarks..."
                        rows={4}
                        className="w-full border border-blue-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    />
                    <div className="flex gap-2 mt-3">
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
                <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="font-semibold text-gray-500">Event:</span> <span className="text-gray-800">{reportData.event_name}</span></div>
                        <div><span className="font-semibold text-gray-500">Committee:</span> <span className="text-gray-800">{reportData.committee}</span></div>
                        <div><span className="font-semibold text-gray-500">Date:</span> <span className="text-gray-800">{reportData.event_date}</span></div>
                        <div><span className="font-semibold text-gray-500">Venue:</span> <span className="text-gray-800">{reportData.venue}</span></div>
                        <div><span className="font-semibold text-gray-500">Proposed By:</span> <span className="text-gray-800">{reportData.proposed_by}</span></div>
                        <div><span className="font-semibold text-gray-500">Status:</span> <span className="text-gray-800">{reportData.status}</span></div>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-500 text-sm mb-1">Description</p>
                        <p className="text-sm text-gray-700">{reportData.description}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-500 text-sm mb-1">Tasks ({reportData.completed_tasks}/{reportData.total_tasks} completed)</p>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3">{reportData.task_details}</pre>
                    </div>
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
