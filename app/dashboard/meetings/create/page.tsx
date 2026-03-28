'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Video, MapPin, Copy, Calendar, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { nanoid } from 'nanoid';

/** `datetime-local` value for min= (user's local clock, minute precision). */
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateMeetingPage() {
  const [committees, setCommittees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [meetingType, setMeetingType] = useState('online');
  const [audienceType, setAudienceType] = useState<'all_members' | 'executive_committee' | 'specific_committee' | 'general'>('all_members');
  const [requireApproval, setRequireApproval] = useState(false);
  const [createdLink, setCreatedLink] = useState('');
  const [minMeetingDateTime, setMinMeetingDateTime] = useState('');
  const router = useRouter();

  // Stable room slug for this form — sent to API so this URL is exactly what gets saved and shared.
  const portalRoomId = useMemo(() => nanoid(), []);
  const portalMeetingLink =
    typeof window !== 'undefined' && meetingType === 'online'
      ? `${window.location.origin}/meet/${portalRoomId}`
      : '';
  const supabase = createClient();

  useEffect(() => { fetchCommittees(); }, []);
  useEffect(() => {
    setMinMeetingDateTime(toDatetimeLocalValue(new Date()));
  }, []);

  async function fetchCommittees() {
    const { data } = await supabase.from('committees').select('id, name').order('name');
    setCommittees(data || []);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const meetingDateRaw = (formData.get('meeting_date') as string)?.trim();
    const meetingInstant = meetingDateRaw ? new Date(meetingDateRaw) : null;
    if (!meetingInstant || Number.isNaN(meetingInstant.getTime())) {
      toast.error('Please choose a valid date and time');
      setLoading(false);
      return;
    }
    // Send UTC instant so server validation matches the user's local choice (fixes "today" when API runs in UTC).
    if (meetingInstant.getTime() <= Date.now()) {
      toast.error('Meeting time must be in the future');
      setLoading(false);
      return;
    }

    const duration = parseInt(String(formData.get('duration') ?? ''), 10);
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error('Enter a valid duration in minutes');
      setLoading(false);
      return;
    }

    const requestBody: Record<string, any> = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || undefined,
      meeting_type: meetingType as 'online' | 'offline',
      meeting_date: meetingInstant.toISOString(),
      duration,
      agenda: (formData.get('agenda') as string) || undefined,
      audience_type: audienceType,
      access_type: audienceType === 'general' ? 'general' : 'invite_only',
      require_approval: audienceType === 'general' ? requireApproval : false,
    };

    if (meetingType === 'offline') {
      requestBody.location = formData.get('location') as string;
    }

    // Online meetings always use internal portal — no platform choice needed

    if (audienceType === 'specific_committee') {
      requestBody.committee_id = formData.get('committee_id') as string;
    }

    if (meetingType === 'online') {
      requestBody.room_id = portalRoomId;
    }

    try {
      const res = await fetch('/api/meetings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create meeting');
        setLoading(false);
        return;
      }

      const finalLink =
        typeof data.meeting_link === 'string' && data.meeting_link.length > 0
          ? data.meeting_link
          : meetingType === 'online' && typeof window !== 'undefined' && data.room_id
            ? `${window.location.origin}/meet/${data.room_id}`
            : '';
      if (finalLink) {
        setCreatedLink(finalLink);
        try {
          await navigator.clipboard.writeText(finalLink);
        } catch {
          /* clipboard may not be available */
        }
        toast.success('Meeting scheduled! Link copied.');
      } else {
        toast.success('Meeting scheduled successfully!');
      }

      setLoading(false);
      setTimeout(() => router.push('/dashboard/meetings'), 2000);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
      setLoading(false);
    }
  }

  const inputClass = "premium-input w-full rounded-xl px-4 py-2.5 text-sm";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="min-h-screen bg-mesh py-8 px-4 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/meetings" className="text-gray-400 hover:text-indigo-600 transition"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-extrabold text-gradient tracking-tight">Schedule Meeting</h1>
        </motion.div>

        {createdLink && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="premium-panel rounded-2xl p-5 mb-6 border-l-4 border-emerald-500">
            <p className="text-sm font-semibold text-emerald-700 mb-2">Meeting created! Share this link:</p>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={createdLink} className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700" />
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { navigator.clipboard.writeText(createdLink); toast.success('Copied'); }}
                className="btn-gradient-green px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1"><Copy className="w-4 h-4" /> Copy</motion.button>
            </div>
          </motion.div>
        )}

        <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          onSubmit={handleSubmit} className="premium-panel rounded-2xl shadow-md overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="p-6 space-y-5">
            <div>
              <label className={labelClass}>Meeting Title</label>
              <input type="text" name="title" required placeholder="e.g., Weekly Sync" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea name="description" rows={2} placeholder="Optional description..." className={inputClass} />
            </div>

            {/* Meeting Type Toggle */}
            <div>
              <label className={labelClass}>Meeting Type</label>
              <div className="flex gap-3">
                {[{ val: 'online', icon: Video, label: 'Online' }, { val: 'offline', icon: MapPin, label: 'In-Person' }].map(t => (
                  <button key={t.val} type="button" onClick={() => setMeetingType(t.val)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${meetingType === t.val ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'glass text-gray-600 hover:shadow-md'}`}>
                    <t.icon className="w-4 h-4" /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Animated field transitions */}
            <AnimatePresence mode="wait">
              {meetingType === 'online' ? (
                <motion.div
                  key="online-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="space-y-5 overflow-hidden"
                >
                  <div>
                    <label className={labelClass}>Your meeting link (saved when you schedule)</label>
                    <p className="text-xs text-gray-500 mb-1.5">
                      Copy and share after scheduling, or use the success banner — this is the exact room URL stored for your meeting.
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                        <input
                          type="text"
                          readOnly
                          value={portalMeetingLink}
                          className={`${inputClass} pl-9 bg-indigo-50/60 text-indigo-700 cursor-default`}
                          aria-label="Portal meeting URL"
                        />
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (!portalMeetingLink) return;
                          void navigator.clipboard.writeText(portalMeetingLink);
                          toast.success('Link copied!');
                        }}
                        className="px-3 py-2.5 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="offline-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="space-y-5 overflow-hidden"
                >
                  <div>
                    <label className={labelClass}>Location</label>
                    <input type="text" name="location" required placeholder="e.g., Main Auditorium" className={inputClass} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date & Time</label>
                <input
                  type="datetime-local"
                  name="meeting_date"
                  required
                  min={minMeetingDateTime || undefined}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Duration (min)</label>
                <input type="number" name="duration" defaultValue="60" required className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Agenda (optional)</label>
              <textarea name="agenda" rows={3} placeholder="Topics to discuss..." className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Invite</label>
              <select value={audienceType} onChange={e => setAudienceType(e.target.value as any)} className={inputClass}>
                <option value="all_members">All Members</option>
                <option value="executive_committee">Executive Committee</option>
                <option value="specific_committee">Specific Committee</option>
                <option value="general">General (Anyone with link)</option>
              </select>
            </div>

            {audienceType === 'general' && meetingType === 'online' && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <input
                  type="checkbox"
                  id="requireApproval"
                  checked={requireApproval}
                  onChange={e => setRequireApproval(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="requireApproval" className="text-sm text-amber-800">
                  Require approval for guests only — anyone signed into the portal joins immediately; organizer, EC, faculty, or admins approve guest requests in the meeting Approvals panel
                </label>
              </div>
            )}

            {audienceType === 'specific_committee' && (
              <div>
                <label className={labelClass}>Select Committee</label>
                <select name="committee_id" required className={inputClass}>
                  <option value="">Choose...</option>
                  {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading}
              className="w-full btn-gradient-purple py-3 rounded-xl font-semibold text-sm shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" /> {loading ? 'Scheduling...' : 'Schedule Meeting'}
            </motion.button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
