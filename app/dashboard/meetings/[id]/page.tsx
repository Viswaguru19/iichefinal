'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Calendar, Clock, MapPin, Video, Users, Link2,
    ExternalLink, FileText, Globe, Monitor, Mail, Send, Loader2, X, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { isAttendanceManager } from '@/lib/attendance-helpers';
import AttendanceSection from '@/components/attendance/AttendanceSection';
import MeetingMinutes from '@/components/MeetingMinutes';

function formatLiveSeconds(sec: number) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}h ${m}m ${r}s`;
    if (m > 0) return `${m}m ${r}s`;
    return `${r}s`;
}

export default function MeetingDetailPage() {
    const [meeting, setMeeting] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isManager, setIsManager] = useState(false);
    const [isEditorial, setIsEditorial] = useState(false);
    const supabase = createClient();
    const router = useRouter();
    const params = useParams();

    const loadData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }

            // Fetch current user profile
            const { data: profile } = await (supabase as any)
                .from('profiles')
                .select('id, name, email, role, executive_role, is_faculty, is_admin, avatar_url')
                .eq('id', user.id)
                .single();
            setCurrentUser(profile);
            const manager = profile ? isAttendanceManager(profile) : false;
            setIsManager(manager);

            // Check if user is in editorial committee or is EC/faculty/admin
            const isEcFacultyAdmin = profile?.executive_role != null || profile?.is_faculty === true || profile?.is_admin === true;
            if (isEcFacultyAdmin) {
                setIsEditorial(true);
            } else {
                const { data: editComm } = await (supabase as any).from('committees').select('id').ilike('name', '%editorial%').single();
                if (editComm) {
                    const { data: membership } = await (supabase as any).from('committee_members').select('id').eq('user_id', user.id).eq('committee_id', editComm.id).single();
                    if (membership) setIsEditorial(true);
                }
            }

            // Fetch meeting with creator profile and committee name
            const { data: meetingData, error: meetingError } = await (supabase as any)
                .from('meetings')
                .select('*, creator:created_by(name, avatar_url), committee:committee_id(name)')
                .eq('id', params.id)
                .single();

            if (meetingError || !meetingData) {
                toast.error('Meeting not found');
                router.push('/dashboard/meetings');
                return;
            }
            setMeeting(meetingData);

            // Meeting creator can also manage attendance
            setIsManager(manager || meetingData.created_by === user.id);

            // Base invitee list (do not replace with only meeting_participants — that hid everyone who had not joined yet)
            let baseProfiles: any[] = [];

            if (meetingData.participants && meetingData.participants.length > 0) {
                const { data: profilesData } = await (supabase as any)
                    .from('profiles')
                    .select('id, name, email, role, executive_role, is_faculty, is_admin')
                    .in('id', meetingData.participants);
                baseProfiles = profilesData || [];
            } else if (meetingData.committee_id) {
                const { data: cmMembers } = await (supabase as any)
                    .from('committee_members')
                    .select('profiles:user_id(id, name, email, role, executive_role, is_faculty, is_admin)')
                    .eq('committee_id', meetingData.committee_id);
                baseProfiles = (cmMembers || []).map((m: any) => m.profiles).filter(Boolean);
            } else if (['all_members', 'general'].includes(String(meetingData.audience_type || ''))) {
                const { data: fallbackProfiles } = await (supabase as any)
                    .from('profiles')
                    .select('id, name, email, role, executive_role, is_faculty, is_admin')
                    .order('name', { ascending: true })
                    .limit(200);
                baseProfiles = fallbackProfiles || [];
            }

            const { data: mpRows } = await (supabase as any)
                .from('meeting_participants')
                .select(
                    'user_id, live_total_seconds, live_last_seen_at, profiles:user_id(id, name, email, role, executive_role, is_faculty, is_admin)',
                )
                .eq('meeting_id', params.id);

            const byId = new Map<string, any>();
            for (const p of baseProfiles) {
                if (p?.id) byId.set(p.id, { ...p });
            }

            for (const row of mpRows || []) {
                const uid = String(row.user_id || '');
                const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                const liveExtra = {
                    live_total_seconds: typeof row.live_total_seconds === 'number' ? row.live_total_seconds : 0,
                    live_last_seen_at: row.live_last_seen_at ?? null,
                    joined_portal_room: true,
                };
                if (uid && byId.has(uid)) {
                    byId.set(uid, { ...byId.get(uid), ...liveExtra });
                } else if (prof?.id) {
                    byId.set(prof.id, { ...prof, ...liveExtra });
                }
            }

            let participantProfiles = Array.from(byId.values());

            // Fetch attendance records
            const { data: attendanceData } = await (supabase as any)
                .from('meeting_attendance')
                .select('*')
                .eq('meeting_id', params.id);
            setAttendance(attendanceData || []);

            // Ensure all attendance users are represented in participants list
            const existingIds = new Set((participantProfiles || []).map((p: any) => p?.id).filter(Boolean));
            const attendanceIds = (attendanceData || []).map((a: any) => a.user_id).filter((id: any) => !!id && !existingIds.has(id));
            if (attendanceIds.length > 0) {
                const { data: attProfiles } = await (supabase as any)
                    .from('profiles')
                    .select('id, name, email, role, executive_role, is_faculty, is_admin')
                    .in('id', attendanceIds);
                participantProfiles = [...participantProfiles, ...(attProfiles || [])];
            }

            // Enrich with committee names
            const enriched = await Promise.all(
                participantProfiles.map(async (prof: any) => {
                    if (!prof) return null;
                    const { data: cm } = await (supabase as any)
                        .from('committee_members')
                        .select('committees:committee_id(name)')
                        .eq('user_id', prof.id)
                        .limit(1);
                    return {
                        ...prof,
                        committeeName: cm?.[0]?.committees?.name || null,
                    };
                })
            );
            setParticipants(enriched.filter(Boolean));
        } catch (err: any) {
            console.error('Error loading meeting detail:', err);
            toast.error('Failed to load meeting details');
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const platformNames: Record<string, string> = {
        microsoft_teams: 'Microsoft Teams',
        google_meet: 'Google Meet',
        zoom: 'Zoom',
        internal_portal: 'Portal',
        other: 'Other',
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-4 animate-pulse-glow flex items-center justify-center">
                        <Video className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-gray-400">Loading meeting details...</p>
                </div>
            </div>
        );
    }

    if (!meeting) return null;

    const date = new Date(meeting.meeting_date);
    const isOnline = meeting.meeting_type === 'online';

    return (
        <div className="min-h-screen bg-mesh relative overflow-hidden">
            <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-pink-400/8 to-violet-400/8 rounded-full blur-3xl pointer-events-none" />

            <PageHeader
                title={meeting.title}
                rightContent={
                    <button
                        onClick={() => router.push('/dashboard/meetings')}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Meetings
                    </button>
                }
            />

            <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
                {/* Meeting Info Card */}
                <div className="premium-panel rounded-2xl p-6 mb-6 shadow-md">
                    {/* Type Badge + Title */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isOnline
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                            : 'bg-gradient-to-br from-emerald-500 to-green-600'
                            }`}>
                            {isOnline ? <Video className="w-5 h-5 text-white" /> : <MapPin className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">{meeting.title}</h2>
                            <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1 ${isOnline
                                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                }`}>
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    {meeting.description && (
                        <p className="text-gray-600 text-sm mb-5 leading-relaxed">{meeting.description}</p>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                            <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400">Date</p>
                                <p className="text-sm font-medium text-gray-700">
                                    {date.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                            <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400">Time &amp; Duration</p>
                                <p className="text-sm font-medium text-gray-700">
                                    {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {meeting.duration} min
                                </p>
                            </div>
                        </div>

                        {isOnline && meeting.platform && (
                            <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                                <Monitor className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-400">Platform</p>
                                    <p className="text-sm font-medium text-gray-700">{platformNames[meeting.platform] || meeting.platform}</p>
                                </div>
                            </div>
                        )}

                        {isOnline && meeting.meeting_link && (
                            <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                                <Link2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-400">Meeting Link</p>
                                    <a
                                        href={meeting.meeting_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 truncate"
                                    >
                                        Join Meeting <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    </a>
                                </div>
                            </div>
                        )}

                        {isOnline &&
                            meeting.live_session_elapsed_seconds != null &&
                            meeting.live_session_elapsed_seconds >= 0 && (
                                <div className="flex items-center gap-3 p-3 bg-violet-50/80 rounded-xl border border-violet-100 sm:col-span-2">
                                    <Clock className="w-4 h-4 text-violet-600 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-violet-600/90">Saved portal session time</p>
                                        <p className="text-sm font-semibold text-violet-900">
                                            {formatLiveSeconds(meeting.live_session_elapsed_seconds)}
                                        </p>
                                        {meeting.live_session_finalized_at && (
                                            <p className="text-[11px] text-violet-700/70 mt-0.5">
                                                Recorded{' '}
                                                {new Date(meeting.live_session_finalized_at).toLocaleString('en-IN', {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short',
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                        {!isOnline && meeting.location && (
                            <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                                <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-400">Location</p>
                                    <p className="text-sm font-medium text-gray-700">{meeting.location}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                            <Users className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400">Participants</p>
                                <p className="text-sm font-medium text-gray-700">{participants.length} members</p>
                            </div>
                        </div>

                        {meeting.committee?.name && (
                            <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                                <Globe className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-400">Committee</p>
                                    <p className="text-sm font-medium text-gray-700">{meeting.committee.name}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Agenda */}
                    {meeting.agenda && (
                        <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Agenda</p>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{meeting.agenda}</p>
                        </div>
                    )}

                    {/* Invite by Email */}
                    <InviteByEmail meetingId={meeting.id} />
                </div>

                {/* Attendance Section */}
                <AttendanceSection
                    meeting={meeting}
                    currentUser={currentUser}
                    attendance={attendance}
                    participants={participants}
                    isManager={isManager}
                    onRefresh={loadData}
                />

                {/* Minutes of Meeting */}
                <MeetingMinutes
                    meeting={meeting}
                    participants={participants}
                    canEdit={isEditorial}
                />
            </div>
        </div>
    );
}

function InviteByEmail({ meetingId }: { meetingId: string }) {
    const [emails, setEmails] = useState<string[]>(['']);
    const [sending, setSending] = useState(false);
    const [showForm, setShowForm] = useState(false);

    function addEmail() { setEmails(prev => [...prev, '']); }
    function removeEmail(idx: number) { setEmails(prev => prev.filter((_, i) => i !== idx)); }
    function updateEmail(idx: number, val: string) { setEmails(prev => prev.map((e, i) => i === idx ? val : e)); }

    async function sendInvites() {
        const valid = emails.filter(e => e.trim() && e.includes('@'));
        if (valid.length === 0) { toast.error('Enter at least one valid email'); return; }
        setSending(true);
        try {
            const res = await fetch('/api/meetings/send-invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId, customEmails: valid }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send');
            toast.success(data.message);
            setEmails(['']);
            setShowForm(false);
        } catch (err: any) { toast.error(err.message); }
        finally { setSending(false); }
    }

    return (
        <div className="mt-4">
            {!showForm ? (
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-lg hover:bg-indigo-50 transition">
                    <Mail className="w-4 h-4" /> Invite by Email
                </button>
            ) : (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide flex items-center gap-1.5">
                            <Mail className="w-4 h-4" /> Send Meeting Invite
                        </p>
                        <button onClick={() => { setShowForm(false); setEmails(['']); }} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2 mb-3">
                        {emails.map((email, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <input type="email" value={email} onChange={e => updateEmail(idx, e.target.value)}
                                    placeholder="email@example.com"
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-300 bg-white" />
                                {emails.length > 1 && (
                                    <button onClick={() => removeEmail(idx)} className="text-red-400 hover:text-red-600 p-1">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={addEmail} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                            <Plus className="w-3.5 h-3.5" /> Add another
                        </button>
                        <div className="flex-1" />
                        <button onClick={sendInvites} disabled={sending}
                            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                            {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <><Send className="w-3.5 h-3.5" /> Send Invites</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
