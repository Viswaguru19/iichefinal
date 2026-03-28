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

interface Props {
  meeting: any;
  participants: any[];
  canEdit: boolean;
}

export default function MeetingMinutes({ meeting, participants, canEdit }: Props) {
  const [minutes, setMinutes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [show, setShow] = useState(false);
  const supabase = createClient();

  const loadMinutes = useCallback(async () => {
    const { data } = await supabase
      .from('meeting_minutes')
      .select('*')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setMinutes(data);
    if (data) setContent(data.content || '');
    setLoading(false);
  }, [meeting.id, supabase]);

  useEffect(() => {
    loadMinutes();
  }, [loadMinutes]);

  const dt = new Date(meeting.meeting_date);

  function hdr() {
    return {
      title: meeting.title,
      committee: meeting.committee?.name || 'N/A',
      date: dt.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      time: dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      duration: (meeting.duration || 0) + ' min',
      location:
        meeting.meeting_type === 'online' ? meeting.platform || 'Online' : meeting.location || 'N/A',
      type: meeting.meeting_type === 'online' ? 'Online' : 'In-Person',
      agenda: meeting.agenda || '',
      participants: participants.map((p: any) => p.name).join(', '),
    };
  }

  async function save() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) {
        toast.error('Log in again');
        setSaving(false);
        return;
      }
      const h = hdr();
      if (minutes) {
        const { error } = await supabase
          .from('meeting_minutes')
          .update({ content: content.trim(), header: JSON.stringify(h) })
          .eq('id', minutes.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meeting_minutes').insert({
          meeting_id: meeting.id,
          title: meeting.title,
          content: content.trim(),
          header: JSON.stringify(h),
          meeting_date: meeting.meeting_date,
          created_by: uid,
        });
        if (error) throw error;
        const { data: ec } = await supabase.from('committees').select('id').ilike('name', '%editorial%').single();
        if (ec) {
          await supabase.from('documents').insert({
            title: 'Minutes: ' + meeting.title,
            file_url: '',
            file_type: 'meeting_minutes',
            document_type: 'meeting_minutes',
            committee_id: ec.id,
            uploaded_by: uid,
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            metadata: { meeting_id: meeting.id },
          });
        }
      }
      toast.success(minutes ? 'Updated!' : 'Created!');
      setEditing(false);
      loadMinutes();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function gh(): any {
    if (!minutes?.header) return null;
    try {
      return typeof minutes.header === 'string' ? JSON.parse(minutes.header) : minutes.header;
    } catch {
      return null;
    }
  }

  function buildFormalMetaRows(h: ReturnType<typeof hdr>): [string, string][] {
    const rows: [string, string][] = [
      ['Meeting title', h.title],
      ['Committee / host', h.committee],
      ['Date', h.date],
      ['Time', h.time],
      ['Duration', h.duration],
      ['Format', h.type],
      ['Venue / platform', h.location],
    ];
    if (h.agenda) rows.push(['Agenda (as scheduled)', h.agenda]);
    if (h.participants) rows.push(['Participants (registered / invited)', h.participants]);
    return rows;
  }

  function dlTxt() {
    const h = gh() || hdr();
    const body = `MINUTES OF MEETING
${FORMAL_ORG_LINE}
${FORMAL_CHAPTER_LINE}
${'═'.repeat(60)}

Meeting: ${h.title}
Committee: ${h.committee}
Date: ${h.date}    Time: ${h.time}
Duration: ${h.duration}    Format: ${h.type}
Location / platform: ${h.location}
${h.agenda ? `Agenda:\n${h.agenda}\n` : ''}
${h.participants ? `Participants:\n${h.participants}\n` : ''}
${'─'.repeat(60)}

RECORD OF PROCEEDINGS

${minutes?.content || ''}

${'═'.repeat(60)}
Prepared via IIChE AVVU Student Chapter portal.
Confidential — for internal chapter use unless released by the Executive Committee.`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    a.download = 'Minutes_' + h.title.replace(/\s+/g, '_') + '.txt';
    a.click();
    toast.success('Downloaded!');
  }

  function minutesHtmlInner(h: ReturnType<typeof hdr>) {
    const rows = buildFormalMetaRows(h)
      .map(([k, v]) => `<tr><td class="lbl">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
      .join('');
    return `
<div class="rule"></div>
<p class="org">${escapeHtml(FORMAL_ORG_LINE)}<br/>${escapeHtml(FORMAL_CHAPTER_LINE)}</p>
<p class="doc-title">MINUTES OF MEETING</p>
<p class="subtitle">Official record of proceedings</p>
<table class="meta">${rows}</table>
<p class="section">Record of proceedings</p>
<div class="body-text">${escapeHtml(minutes?.content || '').replace(/\n/g, '<br/>')}</div>
<div class="footer">
<p>Document generated ${escapeHtml(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}.</p>
<p>Confidential — for internal chapter use unless released by the Executive Committee.</p>
</div>`;
  }

  function dlHtml() {
    const h = gh() || hdr();
    const html = wordHtmlDocument(minutesHtmlInner(h)).replace(/^\ufeff/, '');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    a.download = 'Minutes_' + h.title.replace(/\s+/g, '_') + '.html';
    a.click();
    toast.success('Downloaded HTML');
  }

  function dlDoc() {
    const h = gh() || hdr();
    const html = wordHtmlDocument(minutesHtmlInner(h));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'application/msword;charset=utf-8' }));
    a.download = 'Minutes_' + h.title.replace(/\s+/g, '_') + '.doc';
    a.click();
    toast.success('Downloaded Word (.doc)');
  }

  async function dlPdf() {
    const h = gh() || hdr();
    if (!minutes) return;
    const tid = toast.loading('Building PDF…');
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 48;
      const maxW = W - 2 * margin;
      const valueX = margin + 132;
      let y = margin;

      const drawHeader = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, W, 6, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(FORMAL_ORG_LINE, margin, 24);
        doc.text(FORMAL_CHAPTER_LINE, margin, 34);
        doc.setDrawColor(203, 213, 225);
        doc.line(margin, 42, W - margin, 42);
      };

      const newPage = () => {
        doc.addPage();
        y = 56;
        drawHeader();
        y = 56;
      };

      const need = (space: number) => {
        if (y + space > H - margin) newPage();
      };

      drawHeader();
      y = 56;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(15, 23, 42);
      doc.text('MINUTES OF MEETING', margin, y);
      y += 20;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Official record of proceedings', margin, y);
      y += 26;

      const kv = (label: string, value: string) => {
        const v = String(value || '—');
        need(22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 55);
        const lines = doc.splitTextToSize(v, maxW - (valueX - margin));
        doc.text(lines, valueX, y);
        y += Math.max(16, lines.length * 13) + 5;
      };

      kv('Meeting title', h.title);
      kv('Committee / host', h.committee);
      kv('Date', h.date);
      kv('Time', h.time);
      kv('Duration', h.duration);
      kv('Format', h.type);
      kv('Venue / platform', h.location);
      if (h.agenda) kv('Agenda (scheduled)', h.agenda);
      if (h.participants) kv('Participants', h.participants);

      y += 10;
      need(36);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.text('Record of proceedings', margin, y);
      y += 6;
      doc.setDrawColor(148, 163, 184);
      doc.line(margin, y, W - margin, y);
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      for (const line of doc.splitTextToSize(String(minutes.content || '—'), maxW)) {
        need(14);
        doc.text(line, margin, y);
        y += 13;
      }

      need(28);
      y += 6;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const foot = `Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · Confidential — internal use unless released by the Executive Committee.`;
      for (const fl of doc.splitTextToSize(foot, maxW)) {
        need(12);
        doc.text(fl, margin, y);
        y += 11;
      }

      doc.save('Minutes_' + h.title.replace(/\s+/g, '_') + '.pdf');
      toast.success('PDF downloaded', { id: tid });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'PDF failed', { id: tid });
    }
  }

  if (loading) return null;
  const hd = minutes ? gh() : null;

  return (
    <div className="premium-panel rounded-2xl p-6 shadow-md mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" /> Minutes of Meeting
        </h3>
        <div className="flex gap-2 flex-wrap">
          {minutes && (
            <>
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              >
                <Eye className="w-3.5 h-3.5" /> {show ? 'Hide' : 'View'}
              </button>
              <button
                type="button"
                onClick={dlTxt}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              >
                <Download className="w-3.5 h-3.5" /> TXT
              </button>
              <button
                type="button"
                onClick={dlHtml}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100"
              >
                <Download className="w-3.5 h-3.5" /> HTML
              </button>
              <button
                type="button"
                onClick={dlPdf}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                type="button"
                onClick={dlDoc}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
              >
                <Download className="w-3.5 h-3.5" /> Word
              </button>
            </>
          )}
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                minutes ? 'bg-amber-50 text-amber-600' : 'bg-blue-600 text-white'
              }`}
            >
              {minutes ? (
                <>
                  <Edit className="w-3.5 h-3.5" /> Edit
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Create Minutes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="bg-blue-50 rounded-xl p-5 mb-4 border border-blue-200">
          <p className="text-sm text-blue-700 mb-3">Meeting details are included automatically. Enter the minutes below.</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Points discussed, decisions, action items, resolutions…"
            rows={10}
            className="w-full border border-blue-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none resize-y font-mono"
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !content.trim()}
              className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> {minutes ? 'Update' : 'Save'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                if (minutes) setContent(minutes.content || '');
              }}
              className="flex items-center gap-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {minutes && show && (
        <div className="premium-card rounded-xl p-6 border border-gray-200 space-y-4">
          {hd && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-b border-gray-100 pb-4">
              <div>
                <span className="font-semibold text-gray-500">Meeting:</span> {hd.title}
              </div>
              <div>
                <span className="font-semibold text-gray-500">Committee:</span> {hd.committee}
              </div>
              <div>
                <span className="font-semibold text-gray-500">Date:</span> {hd.date}
              </div>
              <div>
                <span className="font-semibold text-gray-500">Time:</span> {hd.time}
              </div>
              <div>
                <span className="font-semibold text-gray-500">Duration:</span> {hd.duration}
              </div>
              <div>
                <span className="font-semibold text-gray-500">Format:</span> {hd.type}
              </div>
              <div className="sm:col-span-2">
                <span className="font-semibold text-gray-500">Venue / platform:</span> {hd.location}
              </div>
            </div>
          )}
          {hd?.agenda && (
            <div>
              <p className="font-semibold text-gray-500 text-sm mb-1">Agenda</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{hd.agenda}</p>
            </div>
          )}
          {hd?.participants && (
            <div>
              <p className="font-semibold text-gray-500 text-sm mb-1">Participants</p>
              <p className="text-sm text-gray-700">{hd.participants}</p>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-500 text-sm mb-1">Minutes</p>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-4 border border-gray-100">
              {minutes.content}
            </pre>
          </div>
          <p className="text-xs text-gray-400 pt-2 border-t">
            Record created{' '}
            {new Date(minutes.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      )}

      {!minutes && !editing && (
        <p className="text-sm text-gray-400">No minutes yet.{canEdit ? ' Click Create Minutes.' : ''}</p>
      )}
      {minutes && !show && !editing && (
        <p className="text-sm text-gray-500">Minutes saved. Use View or download TXT / HTML / PDF / Word.</p>
      )}
    </div>
  );
}
