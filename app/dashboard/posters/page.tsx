'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { Upload, Image as ImageIcon, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function PostersPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isGraphics, setIsGraphics] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setPageLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: memberships } = await supabase
      .from('committee_members')
      .select('committee_id, committees(name)')
      .eq('user_id', user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    const graphics = (memberships || []).some((m: any) =>
      String(m.committees?.name || '').toLowerCase().includes('graphics'),
    );
    const admin = profile?.is_admin === true;
    setIsGraphics(graphics);
    setIsAdmin(admin);

    if (!graphics && !admin) {
      toast.error('Only Graphics committee or admins can upload posters');
      router.push('/dashboard');
      setPageLoading(false);
      return;
    }

    const { data: evs } = await supabase
      .from('events')
      .select('id, title, poster_url, poster_status, committees(name)')
      .in('status', ['active', 'in_progress'])
      .order('created_at', { ascending: false });

    setEvents(evs || []);
    setPageLoading(false);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!posterFile || !selectedEvent) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const autoApprove = isAdmin;

      const { data: ev } = await supabase.from('events').select('id, title').eq('id', selectedEvent).single();
      if (!ev) throw new Error('Event not found');

      const fileExt = posterFile.name.includes('.') ? posterFile.name.split('.').pop()! : 'jpg';
      const fileName = `${selectedEvent}-${Date.now()}.${fileExt}`;
      const filePath = `event-posters/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('event-documents').upload(filePath, posterFile);
      if (uploadError) throw uploadError;

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
        .eq('id', selectedEvent);

      if (updateError) throw updateError;

      if (!autoApprove) {
        const { data: facultyMembers } = await supabase.from('profiles').select('id').eq('is_faculty', true);
        if (facultyMembers && facultyMembers.length > 0) {
          await supabase.from('notifications').insert(
            facultyMembers.map((f: any) => ({
              user_id: f.id,
              type: 'poster_approval',
              title: 'Poster pending approval',
              message: `A poster for "${ev.title}" was uploaded and needs your approval.`,
              link: `/dashboard/event-detail/${selectedEvent}`,
              metadata: { event_id: selectedEvent },
            })),
          );
        }
        toast.success('Poster uploaded — sent to faculty for approval.');
      } else {
        toast.success('Poster uploaded and published — visible to everyone.');
      }

      setPosterFile(null);
      setSelectedEvent('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!isGraphics && !isAdmin) return null;

  function statusLabel(s: string | null | undefined) {
    if (!s) return null;
    const m: Record<string, string> = {
      pending_faculty_approval: 'Pending faculty',
      approved: 'Published',
      rejected: 'Rejected',
      needs_alteration: 'Changes requested',
    };
    return m[s] || s;
  }

  return (
    <div className="min-h-screen bg-mesh">
      <PageHeader title="Upload event posters" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-600 mb-6">
          {isAdmin
            ? 'As an admin, your poster uploads are published immediately. Graphics uploads still require faculty approval.'
            : 'Posters are reviewed by faculty first. After approval they are visible to everyone on event pages and forms.'}
        </p>

        <div className="premium-panel rounded-2xl p-8 shadow-lg">
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event *</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choose event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                    {ev.committees?.name ? ` — ${ev.committees.name}` : ''}
                    {ev.poster_status ? ` [${statusLabel(ev.poster_status)}]` : ''}
                  </option>
                ))}
              </select>
              {selectedEvent && (
                <Link
                  href={`/dashboard/event-detail/${selectedEvent}`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 mt-2 hover:underline"
                >
                  Open event detail <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Poster file *</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">PNG or JPG. Uploading replaces the current pending file for that event.</p>
            </div>

            <button
              type="submit"
              disabled={loading || !events.length}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {loading ? 'Uploading…' : 'Upload & send to faculty'}
            </button>
          </form>
        </div>

        {events.length === 0 && (
          <div className="mt-6 premium-panel rounded-2xl p-8 text-center">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No active or in-progress events to attach a poster to.</p>
          </div>
        )}
      </div>
    </div>
  );
}
