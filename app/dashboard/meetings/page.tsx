'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, MapPin, Video, Users, Clock, Search, Copy, ExternalLink, Link2, Upload, Trash2 } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import toast from 'react-hot-toast';
import BrandingBadge from '@/components/BrandingBadge';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } } };

export default function MeetingsPage() {
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [past, setPast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [search, setSearch] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isEditorial, setIsEditorial] = useState(false);
  const [editorialCommitteeId, setEditorialCommitteeId] = useState<string | null>(null);
  const [uploadingMinutes, setUploadingMinutes] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { loadMeetings(); }, []);

  async function loadMeetings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setCurrentUserId(user.id);

    // Check if user is in Editorial Committee
    const { data: editComm } = await supabase.from('committees').select('id').ilike('name', '%editorial%').single();
    if (editComm) {
      setEditorialCommitteeId(editComm.id);
      const { data: membership } = await supabase.from('committee_members').select('id').eq('user_id', user.id).eq('committee_id', editComm.id).single();
      if (membership) setIsEditorial(true);
    }
    // Admins/faculty can also upload minutes
    const { data: profile } = await supabase.from('profiles').select('is_admin, is_faculty, executive_role').eq('id', user.id).single();
    if (profile?.is_admin || profile?.is_faculty || profile?.executive_role) setIsEditorial(true);

    const now = new Date();
    const { data: allMeetings } = await supabase.from('meetings')
      .select('*, creator:created_by(name, avatar_url), committee:committee_id(name)')
      .order('meeting_date', { ascending: true });
    const meetings = allMeetings || [];
    const upcomingMeetings = meetings.filter((meeting: any) => {
      const status = String(meeting.status || '').toLowerCase();
      const meetingTime = new Date(meeting.meeting_date);
      // Treat past-dated scheduled meetings as past, not upcoming.
      return status === 'ongoing' || (status !== 'completed' && status !== 'cancelled' && meetingTime >= now);
    });
    const pastMeetings = meetings
      .filter((meeting: any) => !upcomingMeetings.some((up: any) => up.id === meeting.id))
      .sort((a: any, b: any) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
      .slice(0, 30);
    setUpcoming(upcomingMeetings);
    setPast(pastMeetings);
    setLoading(false);
  }

  async function uploadMinutes(meetingId: string, file: File, meetingTitle: string) {
    setUploadingMinutes(meetingId);
    try {
      const ext = file.name.split('.').pop();
      const path = `meeting-minutes/${meetingId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

      // Update meeting with minutes URL
      const { error: meetErr } = await supabase.from('meetings').update({ minutes: urlData.publicUrl }).eq('id', meetingId);
      if (meetErr) throw meetErr;

      // Also save to editorial committee documents
      if (editorialCommitteeId && currentUserId) {
        await supabase.from('documents').insert({
          title: `Minutes: ${meetingTitle}`,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          document_type: 'meeting_minutes',
          committee_id: editorialCommitteeId,
          uploaded_by: currentUserId,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          metadata: { meeting_id: meetingId, original_name: file.name },
        });
      }

      toast.success('Minutes uploaded!');
      loadMeetings();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingMinutes(null);
    }
  }

  async function deleteMeeting(meetingId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this meeting? This cannot be undone.')) return;
    setUpcoming(prev => prev.filter(m => m.id !== meetingId));
    setPast(prev => prev.filter(m => m.id !== meetingId));
    const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
    if (error) { toast.error('Failed to delete: ' + error.message); loadMeetings(); return; }
    toast.success('Meeting deleted');
    loadMeetings();
  }

  function handleJoinCode() {
    if (!joinCode.trim()) return;
    // Try to find meeting by link or redirect
    if (joinCode.startsWith('http')) {
      // Check if it's an internal portal meeting link
      try {
        const url = new URL(joinCode);
        if (url.pathname.startsWith('/meet/')) {
          router.push(url.pathname);
          setJoinCode('');
          return;
        }
      } catch { /* not a valid URL, fall through */ }
      window.open(joinCode, '_blank');
    }
    else { toast.error('Invalid meeting link'); }
    setJoinCode('');
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied');
  }

  const q = search.trim().toLowerCase();
  const matchesSearch = (m: any) => {
    if (!q) return true;
    const title = String(m.title || '').toLowerCase();
    const committee = String(m.committee?.name || '').toLowerCase();
    const creator = String(m.creator?.name || '').toLowerCase();
    return title.includes(q) || committee.includes(q) || creator.includes(q);
  };

  const filteredUpcoming = upcoming.filter(matchesSearch);
  const filteredPast = past.filter(matchesSearch);
  const displayed =
    filter === 'upcoming'
      ? filteredUpcoming
      : filter === 'past'
        ? filteredPast
        : [...filteredUpcoming, ...filteredPast];

  function getAudienceBadge(meeting: any): { label: string; className: string } {
    if (meeting.committee?.name) {
      return { label: meeting.committee.name, className: 'bg-purple-50 text-purple-700 border border-purple-200' };
    }
    return { label: 'All Members', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' };
  }

  const platformColors: Record<string, string> = {
    microsoft_teams: 'from-blue-500 to-indigo-600',
    google_meet: 'from-emerald-500 to-green-600',
    zoom: 'from-blue-600 to-purple-600',
    internal_portal: 'from-violet-500 to-purple-600',
    other: 'from-gray-500 to-gray-600',
  };
  const platformNames: Record<string, string> = {
    microsoft_teams: 'Teams', google_meet: 'Google Meet', zoom: 'Zoom', internal_portal: 'Portal', other: 'Other',
  };

  if (loading) return <PortalLoadingScreen message="Loading meetings…" />;

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <PageHeader
        title="Meetings"
        rightContent={
          <Link href="/dashboard/meetings/create" className="btn-gradient-purple px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-lg shadow-purple-500/20">
            <Plus className="w-4 h-4" /> New Meeting
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <BrandingBadge className="mb-6" />
        {/* Join with Code + Search */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search meetings..."
              className="w-full pl-11 pr-4 py-3 glass-strong rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300/50 transition-all" />
          </div>
          <div className="flex gap-2">
            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Paste meeting link..."
              className="w-64 px-4 py-3 glass-strong rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300/50" />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={handleJoinCode}
              className="btn-gradient-blue px-5 py-3 rounded-2xl text-sm font-semibold shadow-md flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Join
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Calendar, label: 'Upcoming', value: upcoming.length, gradient: 'from-indigo-500 to-purple-500', glow: 'glow-purple' },
            { icon: Clock, label: 'Past', value: past.length, gradient: 'from-emerald-500 to-green-500', glow: 'glow-green' },
            { icon: Users, label: 'Total', value: upcoming.length + past.length, gradient: 'from-amber-500 to-orange-500', glow: 'glow-amber' },
          ].map((s, i) => (
            <motion.div key={i} whileHover={{ y: -4 }} className={`glass-strong rounded-2xl p-5 flex items-center gap-4 shadow-md ${s.glow}`}>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg`}>
                <s.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-800">{s.value}</p>
                <p className="text-sm text-gray-400">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter Tabs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="premium-card rounded-2xl p-1.5 flex gap-1 mb-8 w-fit">
          {(['upcoming', 'past', 'all'] as const).map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`relative px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${filter === tab ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'}`}>
              {filter === tab && (
                <motion.div layoutId="meetingTab" className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">
                {tab.charAt(0).toUpperCase() + tab.slice(1)} (
                {tab === 'upcoming'
                  ? filteredUpcoming.length
                  : tab === 'past'
                    ? filteredPast.length
                    : filteredUpcoming.length + filteredPast.length}
                )
              </span>
            </button>
          ))}
        </motion.div>

        {/* Meetings Grid */}
        {displayed.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="premium-panel rounded-2xl p-16 text-center">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            </motion.div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">No meetings found</h3>
            <p className="text-gray-400 mb-6">
              {filter === 'upcoming'
                ? (q ? 'No upcoming meetings match your search' : 'No upcoming meetings')
                : filter === 'past'
                  ? (q ? 'No past meetings match your search' : 'No past meetings')
                  : (q ? 'No meetings match your search' : 'No meetings yet')}
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link href="/dashboard/meetings/create" className="btn-gradient-purple px-6 py-2.5 rounded-2xl inline-flex items-center gap-2 text-sm font-semibold shadow-lg shadow-purple-500/20">
                <Plus className="w-4 h-4" /> Schedule Meeting
              </Link>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayed.map(meeting => {
              const date = new Date(meeting.meeting_date);
              const isPast = date < new Date();
              const pCount = meeting.participants?.length || 0;
              const platform = meeting.platform || 'other';
              const gradientClass = platformColors[platform] || platformColors.other;
              const audienceBadge = getAudienceBadge(meeting);

              return (
                <motion.div key={meeting.id} variants={item} whileHover={{ y: -6, transition: { duration: 0.2 } }} className="group">
                  <div
                    onClick={() => router.push(`/dashboard/meetings/${meeting.id}`)}
                    className={`glass-strong rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer ${isPast || meeting.status === 'cancelled' || meeting.status === 'completed' ? 'opacity-70' : ''}`}>
                    {/* Top accent */}
                    <div className={`h-1.5 bg-gradient-to-r ${gradientClass}`} />

                    <div className="p-6">
                      {/* Type + Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-sm`}>
                            {meeting.meeting_type === 'online' ? <Video className="w-4 h-4 text-white" /> : <MapPin className="w-4 h-4 text-white" />}
                          </div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">
                            {meeting.meeting_type === 'online' ? platformNames[platform] : 'In-Person'}
                          </span>
                        </div>
                        {(() => {
                          const status = meeting.status || (isPast ? 'completed' : 'scheduled');
                          switch (status) {
                            case 'ongoing':
                              return (
                                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-semibold border border-blue-200 flex items-center gap-1">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                                  </span>
                                  Ongoing
                                </span>
                              );
                            case 'completed':
                              return <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">Completed</span>;
                            case 'cancelled':
                              return <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-semibold border border-red-200">Cancelled</span>;
                            case 'scheduled':
                            default:
                              return <span className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">Scheduled</span>;
                          }
                        })()}
                      </div>

                      {/* Audience Type Badge */}
                      <div className="mb-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${audienceBadge.className}`}>
                          <Users className="w-3 h-3" />
                          {audienceBadge.label}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-gray-800 mb-1 line-clamp-2">{meeting.title}</h3>
                      {meeting.committee && <p className="text-xs text-gray-400 mb-3">{meeting.committee.name}</p>}

                      {/* Date/Time */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-indigo-400" />
                          <span>{date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4 text-indigo-400" />
                          <span>{date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {meeting.duration} min</span>
                        </div>
                        {meeting.meeting_type === 'offline' && meeting.location && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4 text-indigo-400" />
                            <span>{meeting.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Host + Participants */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {meeting.creator?.avatar_url ? (
                            <img src={meeting.creator.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                              {meeting.creator?.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-gray-500">by {meeting.creator?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-2">
                            {meeting.participants?.slice(0, 3).map((p: any, i: number) => (
                              <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-300 to-purple-400 border-2 border-white flex items-center justify-center text-white text-[9px] font-bold">
                                {p.profiles?.name?.[0]?.toUpperCase() || '?'}
                              </div>
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">{pCount}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                        {meeting.meeting_link && !isPast && (
                          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="flex-1">
                            {meeting.meeting_link.includes('/meet/') ? (
                              <button
                                onClick={() => {
                                  const roomId = meeting.meeting_link.split('/meet/').pop();
                                  router.push(`/meet/${roomId}`);
                                }}
                                className="btn-gradient-blue px-3 py-2 rounded-xl text-xs font-semibold text-center block w-full shadow-md">
                                <span className="flex items-center justify-center gap-1.5"><Video className="w-3.5 h-3.5" /> Join</span>
                              </button>
                            ) : (
                              <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer"
                                className="btn-gradient-blue px-3 py-2 rounded-xl text-xs font-semibold text-center block shadow-md">
                                <span className="flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Join</span>
                              </a>
                            )}
                          </motion.div>
                        )}
                        {meeting.meeting_link && (
                          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => copyLink(meeting.meeting_link)}
                            className="p-2 rounded-xl hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all" title="Copy Link">
                            <Copy className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>

                      {/* Agenda */}
                      {meeting.agenda && (
                        <details className="mt-3">
                          <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-indigo-600 transition-colors">View Agenda</summary>
                          <p className="text-xs text-gray-500 mt-2 pl-3 border-l-2 border-indigo-200">{meeting.agenda}</p>
                        </details>
                      )}
                      {isPast && meeting.minutes && (
                        <details className="mt-2">
                          <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-indigo-600 transition-colors">View Minutes</summary>
                          {meeting.minutes.startsWith('http') ? (
                            <a href={meeting.minutes} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-700 mt-2 pl-3 border-l-2 border-emerald-200 block flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Download Minutes
                            </a>
                          ) : (
                            <p className="text-xs text-gray-500 mt-2 pl-3 border-l-2 border-emerald-200">{meeting.minutes}</p>
                          )}
                        </details>
                      )}
                      {/* Upload Minutes - Editorial Committee Only */}
                      {isPast && !meeting.minutes && isEditorial && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <label className="flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium">
                            <Upload className="w-3.5 h-3.5" />
                            {uploadingMinutes === meeting.id ? 'Uploading...' : 'Upload Minutes'}
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt"
                              disabled={uploadingMinutes === meeting.id}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) uploadMinutes(meeting.id, f, meeting.title);
                                e.target.value = '';
                              }} />
                          </label>
                        </div>
                      )}
                      {/* Delete button */}
                      <button onClick={(e) => deleteMeeting(meeting.id, e)}
                        className="text-red-400 hover:text-red-600 p-1 transition-colors mt-2" title="Delete Meeting">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
