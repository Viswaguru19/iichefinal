'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type ComponentType, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkMeetingAccess } from '@/lib/meeting-access';
import toast from 'react-hot-toast';
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    MonitorUp,
    MessageSquare,
    Users,
    LogOut,
    ShieldAlert,
    Loader2,
    UserCircle,
    Send,
    Pin,
    PinOff,
    Link2,
    Info,
    Volume2,
    Speaker,
    Check,
    X,
    Copy,
    Clock,
    Paperclip,
    FileText,
    UserMinus,
    Ellipsis,
} from 'lucide-react';
import { useWebRTC, userIdFromPeerId, type PeerState } from '@/hooks/useWebRTC';
import type { ChatMessage, RoomControlPayload, RoomParticipant, SendChatPayload } from '@/hooks/useWebRTC';
import DynamicLogo from '@/components/DynamicLogo';
import { formatPortalDate } from '@/lib/portal-date';
import {
    applyAudioOutputToElement,
    applyMeetingAudioSession,
    getMeetingAudioContext,
    playSpeakerTestTone,
    resolvePreferredAudioOutput,
    disconnectRemoteStreamFromSpeaker,
    setMeetingAudioSink,
    unlockRemoteMediaElements,
} from '@/lib/meeting-audio-output';
import {
    acquireCameraTrack,
    acquireMeetingMedia,
    bindLocalPreviewVideo,
    isMobileMeetingClient,
    macMediaPermissionHint,
    videoOnlyStream,
} from '@/lib/meeting-devices';

function markMeetingTracks(stream: MediaStream) {
    stream.getAudioTracks().forEach((track) => {
        try {
            if ('contentHint' in track) track.contentHint = 'speech';
        } catch {
            /* ignore */
        }
    });
    stream.getVideoTracks().forEach((track) => {
        try {
            if ('contentHint' in track) track.contentHint = 'motion';
        } catch {
            /* ignore */
        }
    });
    return stream;
}

async function unlockMeetingAudioPlayback() {
    await getMeetingAudioContext();
    unlockRemoteMediaElements();
}

interface Meeting {
    id: string;
    title: string;
    description: string | null;
    meeting_date: string;
    room_id: string | null;
    created_by: string | null;
    status: string;
    require_approval?: boolean | null;
    /** From DB — general link meetings always queue unauthenticated guests for approval */
    access_type?: string | null;
    live_session_elapsed_seconds?: number | null;
    live_session_finalized_at?: string | null;
}

type PendingJoinRequest =
    | { requestKind: 'member'; key: string; user_id: string; profiles?: { name?: string | null; email?: string | null } }
    | { requestKind: 'guest'; key: string; rowId: string; guest_id: string; display_name: string };

function mediaEnabledFlags(stream: MediaStream) {
    return {
        muted: !stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live'),
        cameraOff: !stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'),
    };
}

function guestSessionStorageKey(roomId: string) {
    return `avvu_meet_guest_${roomId}`;
}

function initialsFromDisplayName(name: string | null | undefined) {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDurationSeconds(totalSec: number) {
    const s = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    return `${m}:${String(r).padStart(2, '0')}`;
}

function profileIsEcOrFaculty(p: { is_faculty?: boolean | null; executive_role?: string | null } | null | undefined): boolean {
    if (!p) return false;
    if (p.is_faculty === true) return true;
    return p.executive_role != null && String(p.executive_role).trim() !== '';
}

/** Align presence / DB role strings with on-tile badges (Executive, Faculty, Head, Co-Head, Admin). */
function normalizeMeetingRoleLabel(raw: string | null | undefined): string | null {
    if (raw == null || !String(raw).trim()) return null;
    const s = String(raw).trim();
    const lower = s.toLowerCase().replace(/_/g, ' ');
    if (lower === 'guest') return 'Guest';
    if (lower === 'executive' || lower.includes('executive')) return 'Executive';
    if (lower === 'faculty' || lower.includes('faculty')) return 'Faculty';
    if (lower === 'co head' || lower === 'cohead' || lower === 'co-head') return 'Co-Head';
    if (lower === 'head') return 'Head';
    if (lower.includes('admin') || lower === 'super admin') return 'Admin';
    return s;
}

function resolveProfileAvatarPublicUrl(supabase: SupabaseClient, avatarPath: string | null | undefined): string | null {
    if (avatarPath == null || !String(avatarPath).trim()) return null;
    const p = String(avatarPath).trim();
    if (p.startsWith('http')) return p;
    const { data } = supabase.storage.from('avatars').getPublicUrl(p);
    return data.publicUrl;
}

/** Shown when camera is off: portal profile photo when available, else initials from name (guests use a neutral ring). */
function CameraOffAvatar({
    name,
    profileImageUrl,
    compact,
    isGuest,
    showCameraOffBadge = true,
}: {
    name: string;
    profileImageUrl: string | null;
    compact?: boolean;
    isGuest: boolean;
    showCameraOffBadge?: boolean;
}) {
    const [imgFailed, setImgFailed] = useState(false);
    useEffect(() => {
        setImgFailed(false);
    }, [profileImageUrl]);
    const showImg = Boolean(profileImageUrl && !imgFailed);
    const outer = compact ? 'w-11 h-11' : 'w-24 h-24';
    const textSize = compact ? 'text-[11px]' : 'text-2xl';
    const ring = compact ? 'ring-2 ring-white/15' : 'ring-2 ring-white/15 shadow-lg';
    const fallbackGradient = isGuest ? 'from-gray-600 to-gray-800' : 'from-slate-600 to-slate-800';
    const cornerWrap = compact ? 'w-5 h-5 -bottom-0.5 -right-0.5 border border-white/25' : 'w-10 h-10 -bottom-1 -right-1 border-2 border-white/20';
    const cornerIcon = compact ? 'w-2.5 h-2.5' : 'w-5 h-5';

    return (
        <div className={`relative shrink-0 ${compact ? 'mb-0.5' : ''}`}>
            <div className={`${outer} rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${fallbackGradient} ${ring}`}>
                {showImg ? (
                    <img
                        src={profileImageUrl!}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setImgFailed(true)}
                    />
                ) : (
                    <span className={`${textSize} font-bold text-white/95 tracking-tight`}>{initialsFromDisplayName(name)}</span>
                )}
            </div>
            {showCameraOffBadge ? (
                <div className={`absolute ${cornerWrap} rounded-full bg-slate-950 flex items-center justify-center shadow-md`}>
                    <VideoOff className={`${cornerIcon} text-sky-200`} />
                </div>
            ) : null}
        </div>
    );
}

function MeetingStudioFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className="meet-studio relative min-h-[100dvh] overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -left-10 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
                <div className="absolute top-8 right-0 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="absolute -bottom-16 left-1/3 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            </div>
            <div className={`relative z-10 min-h-[100dvh] ${className}`}>{children}</div>
        </div>
    );
}

function MeetingClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 15_000);
        return () => window.clearInterval(id);
    }, []);
    return (
        <time className="hidden sm:inline tabular-nums text-[13px] font-medium text-white/75">
            {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </time>
    );
}

function MeetDockButton({
    icon: Icon,
    label,
    onClick,
    tone = 'default',
    alert = false,
    dimmed = false,
    wide = false,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    tone?: 'default' | 'off' | 'active' | 'leave';
    alert?: boolean;
    dimmed?: boolean;
    wide?: boolean;
}) {
    const shape = wide ? 'h-12 px-4 sm:px-5 rounded-full gap-2' : 'h-12 w-12 rounded-full';
    const color =
        tone === 'leave'
            ? 'bg-rose-600 text-white hover:bg-rose-500'
            : tone === 'off'
              ? 'bg-white text-rose-600 hover:bg-rose-50'
              : tone === 'active'
                ? 'bg-emerald-400 text-slate-900 hover:bg-emerald-300'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10';
    return (
        <motion.button
            type="button"
            whileHover={{ scale: dimmed ? 1 : 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onClick}
            title={label}
            aria-label={label}
            className={`relative inline-flex items-center justify-center transition ${shape} ${color} ${dimmed ? 'opacity-40' : ''}`}
        >
            <Icon className="w-5 h-5" />
            {wide ? <span className="hidden sm:inline text-sm font-semibold">{label}</span> : null}
            {alert ? <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-sky-300" /> : null}
        </motion.button>
    );
}

export default function MeetingRoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomId =
        typeof params?.id === 'string'
            ? params.id
            : Array.isArray(params?.id)
              ? params.id[0] ?? ''
              : '';
    const supabase = createClient();

    // Core state
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserName, setCurrentUserName] = useState<string>('');
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    /** Resolved public URL from `profiles.avatar_url` for the signed-in user (not guests). */
    const [localProfileAvatarUrl, setLocalProfileAvatarUrl] = useState<string | null>(null);
    /** Loaded for signed-in portal users — used to show Approvals tab (not derived from presence label). */
    const [moderatorProfile, setModeratorProfile] = useState<{
        role: string | null;
        is_faculty: boolean | null;
        is_admin: boolean | null;
        executive_role: string | null;
    } | null>(null);
    const moderatorProfileRef = useRef(moderatorProfile);
    moderatorProfileRef.current = moderatorProfile;
    const [showGuestEntry, setShowGuestEntry] = useState(false);
    const [guestWaitingForApproval, setGuestWaitingForApproval] = useState(false);
    const [guestRejectedReason, setGuestRejectedReason] = useState<string | null>(null);
    const [guestName, setGuestName] = useState('');
    const [hasJoinedMeeting, setHasJoinedMeeting] = useState(false);

    // Media state
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);
    /** Bumps when camera is turned back on so the preview element re-attaches (fixes black tile until pin/unpin). */
    const [localVideoRenderKey, setLocalVideoRenderKey] = useState(0);
    const [speakerOn, setSpeakerOn] = useState(true);
    const [speakerOutputId, setSpeakerOutputId] = useState<string | null>(null);
    const [selfUnmuteLocked, setSelfUnmuteLocked] = useState(false);
    const [removedByModerator, setRemovedByModerator] = useState(false);
    const [meetingSessionDisplaySec, setMeetingSessionDisplaySec] = useState(0);
    const [selfLiveTotalFromDb, setSelfLiveTotalFromDb] = useState(0);
    const [savingLiveSession, setSavingLiveSession] = useState(false);
    /** Gate saving portal session length until attendance is submitted (if any attendance rows exist). */
    const [liveSessionSaveGate, setLiveSessionSaveGate] = useState<'idle' | 'loading' | 'allowed' | 'blocked'>('idle');

    const meetingSessionPausedAccumRef = useRef(0);
    const meetingSessionRunStartedRef = useRef<number | null>(null);
    const sessionSegmentStartRef = useRef<number>(Date.now());

    // Panel state
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);
    const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<PendingJoinRequest[]>([]);
    const [processingApprovalKey, setProcessingApprovalKey] = useState<string | null>(null);
    const [approvalStatusMessage, setApprovalStatusMessage] = useState('Waiting for approval...');

    // Pin state
    const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);

    const preJoinVideoRef = useRef<HTMLVideoElement>(null);

    // Ref to store the original camera track for restoring after screen share
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const screenTrackRef = useRef<MediaStreamTrack | null>(null);

    const ensureLocalMedia = useCallback(async () => {
        if (localStream) return localStream;
        const stream = await acquireMeetingMedia();
        if (!stream) {
            toast.error(`Could not start camera or microphone. ${macMediaPermissionHint()}`);
            return null;
        }
        setLocalStream(stream);
        setIsMuted(!stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live'));
        setIsCameraOff(!stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'));
        return stream;
    }, [localStream]);

    const applySpeakerOutput = useCallback(async (nextSpeakerOn: boolean, { playChime = false } = {}) => {
        applyMeetingAudioSession(nextSpeakerOn);
        await unlockMeetingAudioPlayback();
        const picked = await resolvePreferredAudioOutput(nextSpeakerOn);
        setSpeakerOutputId(picked?.deviceId ?? null);
        await setMeetingAudioSink(picked?.deviceId ?? null);
        if (picked?.deviceId) {
            document.querySelectorAll('audio[data-meeting-remote="1"]').forEach((node) => {
                void applyAudioOutputToElement(node as HTMLMediaElement, picked.deviceId);
            });
        }
        if (playChime) {
            const heard = await playSpeakerTestTone(picked?.deviceId ?? null);
            if (heard) {
                toast.success(nextSpeakerOn
                    ? `Playing on ${picked?.label || 'main speaker'}. Turn up volume (and turn off silent mode on iPhone).`
                    : `Playing on ${picked?.label || 'earpiece'}. Hold the phone to your ear if this is quiet.`);
            } else {
                toast.error('Could not play a test tone. Turn up volume, disable silent mode, then tap Speaker again.');
            }
        }
        return picked;
    }, []);

    const resolvePortalPresenceRole = useCallback(
        async (userId: string): Promise<string | null> => {
            const { data: p } = await supabase
                .from('profiles')
                .select('executive_role, is_faculty, is_admin, role')
                .eq('id', userId)
                .maybeSingle();

            // Priority matters: if user has multiple roles, show the strongest role.
            if (p?.executive_role) return 'Executive';
            if (p?.is_faculty) return 'Faculty';

            const { data: memberships } = await supabase
                .from('committee_members')
                .select('position')
                .eq('user_id', userId);
            const positions = (memberships || []).map((m: any) => String(m.position));
            if (positions.includes('head')) return 'Head';
            if (positions.includes('co_head')) return 'Co-Head';

            if (p?.is_admin || p?.role === 'super_admin' || p?.role === 'secretary') return 'Admin';
            return null;
        },
        [supabase],
    );

    useEffect(() => {
        if (!currentUserId) {
            setLocalProfileAvatarUrl(null);
            return;
        }
        if (currentUserId.startsWith('guest-')) setLocalProfileAvatarUrl(null);
    }, [currentUserId]);

    const meetMediaRef = useRef({ isScreenSharing: false, localStream: null as MediaStream | null, isCameraOff: false });
    meetMediaRef.current = { isScreenSharing, localStream, isCameraOff };

    // WebRTC peer connections
    const {
        peers,
        participants,
        chatMessages,
        sendChatMessage,
        replaceVideoTrack,
        replaceAudioTrack,
        sendRoomControl,
        sendCameraState,
        peerCameraSendingVideo,
        selfPeerId,
        relayAvailable,
    } = useWebRTC({
        supabase,
        roomId,
        userId: currentUserId,
        userName: currentUserName,
        userRole: currentUserRole,
        localStream,
        enabled: !!meeting && !!currentUserId && !!currentUserName && hasJoinedMeeting && !removedByModerator,
        getCameraSendingSnapshot: () => {
            const { isScreenSharing: sharing, isCameraOff: cameraOff } = meetMediaRef.current;
            if (sharing) return true;
            return !cameraOff;
        },
        onRoomControl: (payload: RoomControlPayload) => {
            // Ignore your own control broadcast; sender already knows what they did.
            if (payload.senderId === currentUserId) return;
            if (payload.action === 'mute-all') {
                const creatorId = meeting?.created_by ?? null;
                const iAmCreator = Boolean(creatorId && creatorId === currentUserId);
                const iAmEcOrFaculty = profileIsEcOrFaculty(moderatorProfileRef.current);
                const pol = payload.mutePolicy;
                if (pol === 'creator' && iAmEcOrFaculty) {
                    return;
                }
                if (pol === 'ec_faculty' && iAmCreator) {
                    return;
                }
                localStream?.getAudioTracks().forEach((t) => { t.enabled = false; });
                setIsMuted(true);
                setSelfUnmuteLocked(true);
                toast('Moderator muted everyone. Wait until unmute is allowed.', { icon: '🔇' });
            } else if (payload.action === 'allow-unmute') {
                setSelfUnmuteLocked(false);
                toast('Moderator allowed everyone to unmute.', { icon: '🔊' });
            } else if (payload.action === 'allow-unmute-peer' && payload.targetUserId === currentUserId) {
                setSelfUnmuteLocked(false);
                toast('A moderator allowed you to unmute.', { icon: '🔊' });
            } else if (payload.action === 'kick-peer' && payload.targetUserId === currentUserId) {
                toast.error(`You were removed from the meeting by ${payload.senderName || 'a moderator'}.`);
                setRemovedByModerator(true);
            }
        },
    });

    const participantsRoleKey = useMemo(
        () => participants.map((p) => `${p.userId}:${p.userRole ?? ''}`).join('|'),
        [participants],
    );

    const [peerRoleFallback, setPeerRoleFallback] = useState<Record<string, string | null>>({});
    const [peerAvatarUrls, setPeerAvatarUrls] = useState<Record<string, string | null>>({});

    const portalParticipantIdsKey = useMemo(
        () =>
            [...new Set(participants.filter((p) => p.userId && !p.userId.startsWith('guest-')).map((p) => p.userId))].sort().join(','),
        [participants],
    );

    useEffect(() => {
        let cancelled = false;
        if (!portalParticipantIdsKey) {
            setPeerAvatarUrls({});
            return;
        }
        const ids = portalParticipantIdsKey.split(',').filter(Boolean);
        if (ids.length === 0) {
            setPeerAvatarUrls({});
            return;
        }
        void (async () => {
            const { data, error } = await supabase.from('profiles').select('id, avatar_url').in('id', ids);
            if (cancelled || error) return;
            const next: Record<string, string | null> = {};
            for (const id of ids) next[id] = null;
            for (const row of data || []) {
                next[row.id] = resolveProfileAvatarPublicUrl(supabase, row.avatar_url);
            }
            if (!cancelled) setPeerAvatarUrls(next);
        })();
        return () => {
            cancelled = true;
        };
    }, [portalParticipantIdsKey, supabase]);

    useEffect(() => {
        let cancelled = false;
        const need = participants.filter(
            (p) => p.userId && !p.userId.startsWith('guest-') && !(p.userRole && String(p.userRole).trim()),
        );
        const ids = [...new Set(need.map((p) => p.userId))];
        if (ids.length === 0) return;
        void (async () => {
            const results = await Promise.all(ids.map(async (id) => [id, await resolvePortalPresenceRole(id)] as const));
            if (cancelled) return;
            setPeerRoleFallback((prev) => {
                const next = { ...prev };
                for (const [id, role] of results) {
                    if (next[id] === undefined) next[id] = role;
                }
                return next;
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [participantsRoleKey, resolvePortalPresenceRole]);

    const peerRawRoleByUserId = useMemo(() => {
        const m = new Map<string, string | null | undefined>();
        for (const p of participants) {
            const fromPresence = p.userRole && String(p.userRole).trim() ? p.userRole : peerRoleFallback[p.userId];
            m.set(p.userId, fromPresence ?? null);
        }
        return m;
    }, [participants, peerRoleFallback]);

    const uploadMeetingChatFile = useCallback(
        async (file: File) => {
            const maxBytes = 15 * 1024 * 1024;
            if (file.size > maxBytes) {
                throw new Error('File is too large (max 15 MB)');
            }
            const safeRoom = roomId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
            const uidSeg = currentUserId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
            const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).slice(0, 20) : '';
            const base = `${uidSeg}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const path = `${safeRoom}/${base}${ext}`;
            const { error } = await supabase.storage.from('meeting-chat').upload(path, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || undefined,
            });
            if (error) throw new Error(error.message);
            const { data } = supabase.storage.from('meeting-chat').getPublicUrl(path);
            const kind: 'image' | 'file' = file.type.startsWith('image/') ? 'image' : 'file';
            return { url: data.publicUrl, kind, fileName: file.name };
        },
        [roomId, currentUserId, supabase],
    );

    // Initialize: authenticate, fetch meeting, check access, get media
    useEffect(() => {
        let cancelled = false;

        async function init() {
            try {
                // 1-4. Authenticate, fetch meeting, check access
                const accessResult = await checkMeetingAccess(supabase, roomId);

                if (accessResult.reason === 'pending_approval') {
                    setPendingApproval(true);
                    setMeeting(accessResult.meeting);
                    setCurrentUserId(accessResult.userId || '');
                    if (accessResult.userId) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('name, avatar_url')
                            .eq('id', accessResult.userId)
                            .single();
                        setCurrentUserName(profile?.name || 'Member');
                        setLocalProfileAvatarUrl(resolveProfileAvatarPublicUrl(supabase, profile?.avatar_url));
                    }
                    setLoading(false);
                    return;
                }

                if (accessResult.reason === 'guest_allowed') {
                    const m = accessResult.meeting as Meeting | null | undefined;
                    if (!m?.id) {
                        setMeeting(m ?? null);
                        setShowGuestEntry(true);
                        setLoading(false);
                        return;
                    }
                    const gkey = guestSessionStorageKey(roomId);
                    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(gkey) : null;
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw) as { guestId: string; displayName: string; waiting: boolean };
                            if (parsed.guestId && parsed.displayName) {
                                const { data: st } = await supabase.rpc('get_meeting_guest_request_status', {
                                    p_meeting_id: m.id,
                                    p_guest_id: parsed.guestId,
                                });
                                if (st === 'rejected') {
                                    sessionStorage.removeItem(gkey);
                                    setMeeting(m);
                                    setGuestRejectedReason('Your join request was not approved.');
                                    setGuestName(parsed.displayName);
                                    setShowGuestEntry(true);
                                    setGuestWaitingForApproval(false);
                                    setLoading(false);
                                    return;
                                }
                                if (st === 'approved') {
                                    setMeeting(m);
                                    setCurrentUserId(parsed.guestId);
                                    setCurrentUserName(parsed.displayName);
                                    setCurrentUserRole('Guest');
                                    setShowGuestEntry(false);
                                    setGuestWaitingForApproval(false);
                                    sessionStorage.setItem(gkey, JSON.stringify({ ...parsed, waiting: false }));
                                    const stream = await acquireMeetingMedia();
                                    if (!cancelled && stream) {
                                        setLocalStream(stream);
                                        const flags = mediaEnabledFlags(stream);
                                        setIsMuted(flags.muted);
                                        setIsCameraOff(flags.cameraOff);
                                    }
                                    setLoading(false);
                                    return;
                                }
                                if (st === 'pending') {
                                    setMeeting(m);
                                    setCurrentUserId(parsed.guestId);
                                    setCurrentUserName(parsed.displayName);
                                    setCurrentUserRole('Guest');
                                    setGuestWaitingForApproval(true);
                                    setShowGuestEntry(false);
                                    setLoading(false);
                                    return;
                                }
                                if (st == null) {
                                    sessionStorage.removeItem(gkey);
                                }
                            }
                        } catch {
                            /* fall through to guest form */
                        }
                    }
                    setMeeting(m);
                    setShowGuestEntry(true);
                    setLoading(false);
                    return;
                }

                if (!accessResult.granted || !accessResult.meeting || !accessResult.userId) {
                    setAccessDenied(true);
                    setLoading(false);
                    return;
                }

                if (cancelled) return;

                const meetingData = accessResult.meeting;
                setMeeting(meetingData);
                setCurrentUserId(accessResult.userId);
                const resolvedRole = await resolvePortalPresenceRole(accessResult.userId);
                if (!cancelled) {
                    setCurrentUserRole(resolvedRole || accessResult.userRole || null);
                }

                // 5. Fetch user profile name
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, avatar_url')
                    .eq('id', accessResult.userId)
                    .single();
                if (!cancelled) {
                    setCurrentUserName(profile?.name || 'Anonymous');
                    setLocalProfileAvatarUrl(resolveProfileAvatarPublicUrl(supabase, profile?.avatar_url));
                }

                const stream = await acquireMeetingMedia();
                if (!cancelled && stream) {
                    setLocalStream(stream);
                    const flags = mediaEnabledFlags(stream);
                    setIsMuted(flags.muted);
                    setIsCameraOff(flags.cameraOff);
                }

                setLoading(false);
            } catch {
                setAccessDenied(true);
                setLoading(false);
            }
        }

        init();

        return () => {
            cancelled = true;
        };
    }, [roomId]);

    useEffect(() => {
        const el = preJoinVideoRef.current;
        if (!el) return;
        if (!localStream || isCameraOff) {
            el.srcObject = null;
            return;
        }
        bindLocalPreviewVideo(el, localStream);
        let attemptsLeft = 8;
        const retry = window.setInterval(() => {
            if (el.videoWidth > 0 || attemptsLeft <= 0) {
                window.clearInterval(retry);
                return;
            }
            attemptsLeft -= 1;
            bindLocalPreviewVideo(el, localStream);
        }, 400);
        return () => {
            window.clearInterval(retry);
            el.srcObject = null;
        };
    }, [localStream, isCameraOff, localVideoRenderKey]);

    useEffect(() => {
        if (isCameraOff && !isScreenSharing) {
            setLocalPreviewStream(null);
            return;
        }
        const preview = videoOnlyStream(
            localStream,
            isScreenSharing ? screenTrackRef.current : null,
            { enabledOnly: true },
        );
        setLocalPreviewStream(preview);
    }, [localStream, isScreenSharing, isCameraOff]);

    // Persist joined participants for attendance screens (skip guest IDs).
    useEffect(() => {
        const saveParticipant = async () => {
            if (!hasJoinedMeeting || !meeting?.id || !currentUserId || currentUserId.startsWith('guest-')) return;
            await (supabase as any)
                .from('meeting_participants')
                .upsert(
                    {
                        meeting_id: meeting.id,
                        user_id: currentUserId,
                        live_last_seen_at: new Date().toISOString(),
                    },
                    { onConflict: 'meeting_id,user_id' }
                );
        };
        void saveParticipant();
    }, [hasJoinedMeeting, meeting?.id, currentUserId, supabase]);

    const flushLiveDwellToServer = useCallback(async () => {
        if (!meeting?.id || !currentUserId || currentUserId.startsWith('guest-') || removedByModerator) return;
        const delta = Math.floor((Date.now() - sessionSegmentStartRef.current) / 1000);
        if (delta < 1) return;
        sessionSegmentStartRef.current = Date.now();
        const { error } = await (supabase as any).rpc('add_meeting_participant_live_seconds', {
            p_meeting_id: meeting.id,
            p_delta: delta,
        });
        if (!error) {
            const { data: row } = await supabase
                .from('meeting_participants')
                .select('live_total_seconds')
                .eq('meeting_id', meeting.id)
                .eq('user_id', currentUserId)
                .maybeSingle();
            if (row && typeof (row as { live_total_seconds?: number }).live_total_seconds === 'number') {
                setSelfLiveTotalFromDb((row as { live_total_seconds: number }).live_total_seconds);
            }
        }
    }, [meeting?.id, currentUserId, supabase, removedByModerator]);

    useEffect(() => {
        if (!hasJoinedMeeting || !meeting?.id || currentUserId.startsWith('guest-')) return;
        sessionSegmentStartRef.current = Date.now();
    }, [hasJoinedMeeting, meeting?.id, currentUserId]);

    useEffect(() => {
        if (!hasJoinedMeeting || !meeting?.id || !currentUserId || currentUserId.startsWith('guest-')) return;
        let cancelled = false;
        void (async () => {
            const { data } = await supabase
                .from('meeting_participants')
                .select('live_total_seconds')
                .eq('meeting_id', meeting.id)
                .eq('user_id', currentUserId)
                .maybeSingle();
            if (!cancelled && data && typeof (data as { live_total_seconds?: number }).live_total_seconds === 'number') {
                setSelfLiveTotalFromDb((data as { live_total_seconds: number }).live_total_seconds);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hasJoinedMeeting, meeting?.id, currentUserId, supabase]);

    useEffect(() => {
        if (!hasJoinedMeeting || removedByModerator) return;
        const interval = setInterval(() => {
            void flushLiveDwellToServer();
        }, 45000);
        return () => clearInterval(interval);
    }, [hasJoinedMeeting, removedByModerator, flushLiveDwellToServer]);

    const flushLiveDwellRef = useRef(flushLiveDwellToServer);
    flushLiveDwellRef.current = flushLiveDwellToServer;
    useEffect(
        () => () => {
            void flushLiveDwellRef.current();
        },
        [],
    );

    const othersPresentCount = useMemo(
        () => participants.filter((p) => p.peerId !== selfPeerId).length,
        [participants, selfPeerId],
    );

    useEffect(() => {
        if (!hasJoinedMeeting || removedByModerator) return;

        const tick = () => {
            const runStart = meetingSessionRunStartedRef.current;
            const extra = runStart != null ? Math.floor((Date.now() - runStart) / 1000) : 0;
            setMeetingSessionDisplaySec(meetingSessionPausedAccumRef.current + extra);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [hasJoinedMeeting, removedByModerator, othersPresentCount]);

    useEffect(() => {
        if (!hasJoinedMeeting || removedByModerator) return;
        if (othersPresentCount === 0) {
            const runStart = meetingSessionRunStartedRef.current;
            if (runStart != null) {
                meetingSessionPausedAccumRef.current += Math.floor((Date.now() - runStart) / 1000);
                meetingSessionRunStartedRef.current = null;
            }
            return;
        }
        if (meetingSessionRunStartedRef.current === null) {
            meetingSessionRunStartedRef.current = Date.now();
        }
    }, [hasJoinedMeeting, removedByModerator, othersPresentCount]);

    useEffect(() => {
        if (!removedByModerator) return;
        const t = setTimeout(() => router.push('/dashboard/meetings'), 1600);
        return () => clearTimeout(t);
    }, [removedByModerator, router]);

    // Cleanup media on unmount
    useEffect(() => {
        return () => {
            localStream?.getTracks().forEach((track) => track.stop());
        };
    }, [localStream]);

    useEffect(() => {
        if (!currentUserId || currentUserId.startsWith('guest-')) {
            setModeratorProfile(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            const { data: p } = await supabase
                .from('profiles')
                .select('role, is_faculty, is_admin, executive_role')
                .eq('id', currentUserId)
                .maybeSingle();
            if (!cancelled) setModeratorProfile(p ?? null);
        })();
        return () => {
            cancelled = true;
        };
    }, [currentUserId, supabase]);

    const meetingUsesGuestApprovalQueue =
        meeting?.access_type === 'general' || !!meeting?.require_approval;

    const canApproveRequests =
        meetingUsesGuestApprovalQueue &&
        !!meeting?.id &&
        !!currentUserId &&
        !currentUserId.startsWith('guest-') &&
        (meeting?.created_by === currentUserId ||
            !!moderatorProfile?.is_faculty ||
            !!moderatorProfile?.is_admin ||
            !!moderatorProfile?.executive_role ||
            moderatorProfile?.role === 'super_admin' ||
            moderatorProfile?.role === 'secretary');

    /** Mute/unmute all, kick, unmute one peer, save session time — creator, EC, or faculty only */
    const canModerateMeetingRoom =
        !!meeting?.id &&
        !!currentUserId &&
        !currentUserId.startsWith('guest-') &&
        (meeting?.created_by === currentUserId || profileIsEcOrFaculty(moderatorProfile));

    useEffect(() => {
        if (!meeting?.id || !hasJoinedMeeting || !canModerateMeetingRoom) {
            setLiveSessionSaveGate('idle');
            return;
        }
        let cancelled = false;
        const refreshGate = async (showLoading: boolean) => {
            if (showLoading) setLiveSessionSaveGate('loading');
            const { data: rows, error } = await supabase
                .from('meeting_attendance')
                .select('submitted')
                .eq('meeting_id', meeting.id);
            if (cancelled) return;
            if (error) {
                console.warn('meeting_attendance gate read failed', error);
                setLiveSessionSaveGate('allowed');
                return;
            }
            const list = rows ?? [];
            if (list.length === 0) {
                setLiveSessionSaveGate('allowed');
                return;
            }
            const allSubmitted = list.every((r: { submitted?: boolean | null }) => r.submitted === true);
            setLiveSessionSaveGate(allSubmitted ? 'allowed' : 'blocked');
        };
        void refreshGate(true);
        const t = setInterval(() => { void refreshGate(false); }, 20000);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [meeting?.id, hasJoinedMeeting, canModerateMeetingRoom, supabase]);

    const loadPendingRequests = useCallback(async () => {
        if (!meeting?.id || !canApproveRequests) return;
        const [mpRes, grRes] = await Promise.all([
            supabase
                .from('meeting_participants')
                .select('meeting_id, user_id, rsvp_status, invited_at, profiles:user_id(name, email)')
                .eq('meeting_id', meeting.id)
                .eq('rsvp_status', 'pending')
                .order('invited_at', { ascending: true }),
            supabase
                .from('meeting_guest_requests')
                .select('id, guest_id, display_name, created_at')
                .eq('meeting_id', meeting.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: true }),
        ]);
        const members = (mpRes.data || []).map((r: any) => {
            const profileRow = Array.isArray(r?.profiles) ? r.profiles[0] : r?.profiles;
            return {
                requestKind: 'member' as const,
                key: `m:${String(r?.user_id || '')}`,
                user_id: String(r?.user_id || ''),
                profiles: profileRow
                    ? {
                          name: profileRow.name ?? null,
                          email: profileRow.email ?? null,
                      }
                    : undefined,
            };
        });
        const guests = (grRes.data || []).map(
            (r: { id: string; guest_id: string; display_name: string }) =>
                ({
                    requestKind: 'guest' as const,
                    key: `g:${r.id}`,
                    rowId: r.id,
                    guest_id: r.guest_id,
                    display_name: r.display_name,
                }),
        );
        setPendingRequests([...members, ...guests]);
    }, [meeting?.id, canApproveRequests, supabase]);

    useEffect(() => {
        if (!meeting?.id || !canApproveRequests) return;
        void loadPendingRequests();
        const timer = setInterval(() => { void loadPendingRequests(); }, 6000);
        return () => clearInterval(timer);
    }, [meeting?.id, canApproveRequests, loadPendingRequests]);

    useEffect(() => {
        if (!pendingApproval || !meeting?.id || !currentUserId) return;
        const ensurePendingRequest = async () => {
            await (supabase as any)
                .from('meeting_participants')
                .upsert(
                    { meeting_id: meeting.id, user_id: currentUserId, rsvp_status: 'pending' },
                    { onConflict: 'meeting_id,user_id' }
                );
        };
        void ensurePendingRequest();
    }, [pendingApproval, meeting?.id, currentUserId]);

    useEffect(() => {
        if (!pendingApproval) return;
        let cancelled = false;

        const checkApproval = async () => {
            const next = await checkMeetingAccess(supabase, roomId);
            if (cancelled) return;
            if (next.granted && next.meeting && next.userId) {
                setApprovalStatusMessage('Approved. Joining meeting...');
                setPendingApproval(false);
                setMeeting(next.meeting);
                setCurrentUserId(next.userId);
                const resolvedRole = await resolvePortalPresenceRole(next.userId);
                if (!cancelled) {
                    setCurrentUserRole(resolvedRole || next.userRole || null);
                }
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, avatar_url')
                    .eq('id', next.userId)
                    .single();
                if (!cancelled) {
                    setCurrentUserName(profile?.name || 'Member');
                    setLocalProfileAvatarUrl(resolveProfileAvatarPublicUrl(supabase, profile?.avatar_url));
                }
                const stream = await acquireMeetingMedia();
                if (!cancelled && stream) {
                    setLocalStream(stream);
                    const flags = mediaEnabledFlags(stream);
                    setIsMuted(flags.muted);
                    setIsCameraOff(flags.cameraOff);
                }
            } else {
                setApprovalStatusMessage('Waiting for organizer/EC/faculty approval...');
            }
        };

        void checkApproval();
        const timer = setInterval(() => { void checkApproval(); }, 3500);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [pendingApproval, roomId, resolvePortalPresenceRole, supabase]);

    useEffect(() => {
        if (!guestWaitingForApproval || !meeting?.id || !currentUserId) return;
        let cancelled = false;
        const tick = async () => {
            const { data: st, error } = await supabase.rpc('get_meeting_guest_request_status', {
                p_meeting_id: meeting.id,
                p_guest_id: currentUserId,
            });
            if (cancelled || error) return;
            if (st === 'approved') {
                sessionStorage.setItem(
                    guestSessionStorageKey(roomId),
                    JSON.stringify({
                        guestId: currentUserId,
                        displayName: currentUserName,
                        waiting: false,
                    }),
                );
                setGuestWaitingForApproval(false);
                const stream = await acquireMeetingMedia();
                if (!cancelled && stream) {
                    setLocalStream(stream);
                    const flags = mediaEnabledFlags(stream);
                    setIsMuted(flags.muted);
                    setIsCameraOff(flags.cameraOff);
                }
            } else if (st === 'rejected') {
                sessionStorage.removeItem(guestSessionStorageKey(roomId));
                setGuestWaitingForApproval(false);
                setGuestRejectedReason('Your join request was not approved.');
                setGuestName(currentUserName);
                setShowGuestEntry(true);
            }
        };
        void tick();
        const timer = setInterval(() => { void tick(); }, 3500);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [guestWaitingForApproval, meeting?.id, currentUserId, currentUserName, roomId, supabase]);

    useEffect(() => {
        if (!localStream || isMuted) {
            setMicLevel(0);
            return;
        }
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack || !audioTrack.enabled) {
            setMicLevel(0);
            return;
        }
        let ctx: AudioContext | null = null;
        let source: MediaStreamAudioSourceNode | null = null;
        let analyser: AnalyserNode | null = null;
        let probe: MediaStreamTrack | null = null;
        let raf = 0;
        try {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return;
            ctx = new Ctx();
            analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            probe = audioTrack.clone();
            source = ctx.createMediaStreamSource(new MediaStream([probe]));
            source.connect(analyser);
            const arr = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(arr);
                let sum = 0;
                for (let i = 0; i < arr.length; i++) sum += arr[i];
                const avg = sum / arr.length;
                setMicLevel(Math.min(100, Math.round((avg / 255) * 180)));
                raf = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            console.warn('Mic level analyser unavailable', e);
            setMicLevel(0);
        }
        return () => {
            cancelAnimationFrame(raf);
            try {
                source?.disconnect();
                analyser?.disconnect();
                probe?.stop();
            } catch {
                /* ignore */
            }
            void ctx?.close();
        };
    }, [localStream, isMuted]);

    // Media controls
    const toggleMute = useCallback(() => {
        const run = async () => {
            const stream = await ensureLocalMedia();
            if (!stream) return;
            if (isMuted && selfUnmuteLocked && !canModerateMeetingRoom) {
                toast.error('A moderator has locked unmute. Wait for Unmute all or for a moderator to unmute you.');
                return;
            }
            let audioTrack = stream.getAudioTracks()[0];
            const needsFreshTrack = !audioTrack || audioTrack.readyState !== 'live';
            if (needsFreshTrack) {
                try {
                    const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const fresh = audioOnly.getAudioTracks()[0];
                    if (fresh) {
                        fresh.enabled = true;
                        const old = stream.getAudioTracks()[0];
                        if (old) {
                            stream.removeTrack(old);
                            old.stop();
                        }
                        stream.addTrack(fresh);
                        markMeetingTracks(new MediaStream([fresh]));
                        await replaceAudioTrack(fresh);
                        audioTrack = fresh;
                    }
                } catch {
                    toast.error(`Could not access microphone. ${macMediaPermissionHint()}`);
                    return;
                }
            }
            if (!audioTrack) return;
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        };
        void run();
    }, [canModerateMeetingRoom, ensureLocalMedia, isMuted, selfUnmuteLocked, replaceAudioTrack]);

    const reacquireAndBindCameraTrack = useCallback(
        async (stream: MediaStream) => {
            const freshTrack = await acquireCameraTrack();
            if (!freshTrack) return null;
            freshTrack.enabled = true;

            const oldTrack = stream.getVideoTracks()[0];
            if (oldTrack) {
                stream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            stream.addTrack(freshTrack);

            await replaceVideoTrack(freshTrack);
            const next = new MediaStream(stream.getTracks());
            setLocalStream(next);
            setLocalVideoRenderKey((k) => k + 1);
            return freshTrack;
        },
        [replaceVideoTrack],
    );

    useEffect(() => {
        if (!hasJoinedMeeting) return;
        if (isScreenSharing) {
            sendCameraState(true);
            return;
        }
        sendCameraState(isScreenSharing || !isCameraOff);
    }, [hasJoinedMeeting, localStream, isCameraOff, isScreenSharing, sendCameraState]);

    useEffect(() => {
        if (!hasJoinedMeeting) return;
        void applySpeakerOutput(speakerOn);
    }, [hasJoinedMeeting, speakerOn, applySpeakerOutput]);

    const toggleSpeaker = useCallback(() => {
        const next = !speakerOn;
        setSpeakerOn(next);
        void applySpeakerOutput(next, { playChime: true });
    }, [speakerOn, applySpeakerOutput]);

    const toggleCamera = useCallback(() => {
        const run = async () => {
            const stream = await ensureLocalMedia();
            if (!stream) return;

            // Do not replace the outbound video track while screen sharing — that would
            // yank the screen off the wire. Only flip the saved camera track's enabled flag.
            if (isScreenSharing) {
                const cam = cameraTrackRef.current || stream.getVideoTracks().find((t) => t.readyState === 'live');
                if (isCameraOff) {
                    if (cam && cam.readyState === 'live') cam.enabled = true;
                    setIsCameraOff(false);
                } else if (cam) {
                    cam.enabled = false;
                    setIsCameraOff(true);
                }
                return;
            }

            // The camera track is disabled rather than stopped. Stopping it forces a
            // second getUserMedia to turn the camera back on, and on iOS that call
            // ends the tracks already in use — including the microphone, which left
            // the other side unable to hear you after a camera toggle.
            if (isCameraOff) {
                try {
                    const existing = stream.getVideoTracks().find((t) => t.readyState === 'live');
                    // Mac Chrome/Safari often never paint again after track.enabled = false.
                    // Re-open the camera on desktop. On iOS a second getUserMedia can kill the mic.
                    const reopenCamera = !isMobileMeetingClient() || !existing;
                    if (reopenCamera) {
                        if (!(await reacquireAndBindCameraTrack(stream))) {
                            toast.error(`Could not turn on camera. ${macMediaPermissionHint()}`);
                            return;
                        }
                    } else {
                        existing.enabled = true;
                        setLocalStream(new MediaStream(stream.getTracks()));
                    }
                    setLocalVideoRenderKey((k) => k + 1);
                    setIsCameraOff(false);
                    sendCameraState(true);
                } catch {
                    toast.error(`Could not turn on camera. ${macMediaPermissionHint()}`);
                }
                return;
            }

            for (const track of stream.getVideoTracks()) track.enabled = false;
            setLocalStream(new MediaStream(stream.getTracks()));
            setLocalVideoRenderKey((k) => k + 1);
            setIsCameraOff(true);
            sendCameraState(false);
        };
        void run();
    }, [ensureLocalMedia, isCameraOff, isScreenSharing, reacquireAndBindCameraTrack, sendCameraState]);

    const stopScreenShare = useCallback(async () => {
        const screenTrack = screenTrackRef.current;
        if (screenTrack) {
            screenTrack.onended = null;
            try { screenTrack.stop(); } catch { /* ignore */ }
        }
        screenTrackRef.current = null;

        let camTrack = cameraTrackRef.current;
        if (!camTrack || camTrack.readyState !== 'live') {
            camTrack = localStream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
        }
        cameraTrackRef.current = null;
        await replaceVideoTrack(camTrack);
        setLocalPreviewStream(null);
        setLocalVideoRenderKey((k) => k + 1);
        setIsScreenSharing(false);
        const camOn = Boolean(camTrack?.enabled && camTrack.readyState === 'live');
        setIsCameraOff(!camOn);
        sendCameraState(camOn);
    }, [localStream, replaceVideoTrack, sendCameraState]);

    const toggleScreenShare = useCallback(async () => {
        const activeStream = localStream || await ensureLocalMedia();
        if (!activeStream) return;

        if (isScreenSharing) {
            await stopScreenShare();
            return;
        }

        if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
            toast.error(
                'Screen sharing is not available in this browser. Try Chrome or Edge on a desktop; many mobile browsers do not support it yet.',
            );
            return;
        }
        try {
            let screenStream: MediaStream;
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { frameRate: 15, width: { max: 1920 }, height: { max: 1080 } },
                    audio: false,
                });
            } catch {
                screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            }
            const screenTrack = screenStream.getVideoTracks()[0];
            if (!screenTrack) {
                toast.error('Could not capture the screen.');
                return;
            }
            try {
                if ('contentHint' in screenTrack) screenTrack.contentHint = 'detail';
            } catch {
                /* ignore */
            }
            // Drop any display-audio tracks so the microphone (your voice) stays on the wire.
            screenStream.getAudioTracks().forEach((t) => {
                try { t.stop(); } catch { /* ignore */ }
            });

            const originalCameraTrack = activeStream.getVideoTracks()[0] ?? null;
            cameraTrackRef.current = originalCameraTrack;
            screenTrackRef.current = screenTrack;

            await replaceVideoTrack(screenTrack);
            setLocalPreviewStream(new MediaStream([screenTrack]));

            screenTrack.onended = () => {
                void stopScreenShare();
            };

            setIsScreenSharing(true);
            sendCameraState(true);
        } catch {
            console.warn('Screen sharing cancelled or failed');
        }
    }, [localStream, ensureLocalMedia, isScreenSharing, replaceVideoTrack, sendCameraState, stopScreenShare]);

    const leaveMeeting = useCallback(() => {
        localStream?.getTracks().forEach((track) => track.stop());
        cameraTrackRef.current?.stop();
        cameraTrackRef.current = null;
        screenTrackRef.current?.stop();
        screenTrackRef.current = null;
        setLocalStream(null);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(guestSessionStorageKey(roomId));
        }
        router.push('/dashboard/meetings');
    }, [localStream, router, roomId]);

    const saveLiveSessionToMeeting = useCallback(async () => {
        if (!meeting?.id || !canModerateMeetingRoom) return;
        if (liveSessionSaveGate !== 'allowed') {
            toast.error('Finalize attendance on the dashboard meeting page first, then save session time here.');
            return;
        }
        setSavingLiveSession(true);
        try {
            const elapsed = meetingSessionDisplaySec;
            const { error } = await (supabase as any).rpc('finalize_meeting_live_session', {
                p_meeting_id: meeting.id,
                p_elapsed_seconds: elapsed,
            });
            if (error) {
                const msg = String((error as { message?: string }).message || '');
                if (msg.includes('attendance_not_finalized')) {
                    toast.error('Attendance must be finalized on the meeting page before saving session time.');
                    setLiveSessionSaveGate('blocked');
                    return;
                }
                throw error;
            }
            setMeeting((prev) =>
                prev
                    ? {
                          ...prev,
                          live_session_elapsed_seconds: elapsed,
                          live_session_finalized_at: new Date().toISOString(),
                      }
                    : null,
            );
            toast.success('Saved active session time to this meeting (visible on the meeting page).');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Could not save session time';
            toast.error(msg);
        } finally {
            setSavingLiveSession(false);
        }
    }, [meeting?.id, canModerateMeetingRoom, meetingSessionDisplaySec, supabase, liveSessionSaveGate]);

    // Loading state
    if (loading) {
        return (
            <MeetingStudioFrame className="min-h-[100dvh] flex items-center justify-center">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-sky-300 animate-spin" />
                    <p className="text-white/80 text-sm font-medium">Opening the room…</p>
                </motion.div>
            </MeetingStudioFrame>
        );
    }

    // Access denied state
    // Pending approval state
    if (pendingApproval) {
        return (
            <MeetingStudioFrame className="min-h-[100dvh] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl shadow-2xl"
                >
                    <Loader2 className="w-11 h-11 text-sky-300 mx-auto mb-4 animate-spin" />
                    <h2 className="text-2xl font-semibold text-white mb-2">Waiting to be let in</h2>
                    <p className="text-sky-100/80 text-sm mb-3">{meeting?.title}</p>
                    <p className="text-white/55 text-sm mb-6">An organizer will approve your request. Keep this page open.</p>
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-sky-400/15 border border-sky-300/25 px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-300 animate-pulse" />
                        <span className="text-xs text-sky-100">{approvalStatusMessage}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/meetings')}
                        className="w-full rounded-2xl bg-white text-slate-900 py-3 text-sm font-semibold hover:bg-sky-50 transition"
                    >
                        Back to meetings
                    </button>
                </motion.div>
            </MeetingStudioFrame>
        );
    }

    if (guestWaitingForApproval && meeting) {
        return (
            <MeetingStudioFrame className="min-h-[100dvh] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl shadow-2xl"
                >
                    <Loader2 className="w-11 h-11 text-sky-300 mx-auto mb-4 animate-spin" />
                    <h2 className="text-2xl font-semibold text-white mb-2">Waiting to be let in</h2>
                    <p className="text-sky-100/80 text-sm mb-3">{meeting.title ?? 'Meeting'}</p>
                    <p className="text-white/55 text-sm mb-5">
                        You are <span className="text-white font-medium">{currentUserName}</span>. Share this guest ID if the host asks.
                    </p>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 mb-5 text-left">
                        <p className="text-[10px] uppercase tracking-wide text-sky-200/70 mb-1">Guest ID</p>
                        <div className="flex items-center gap-2">
                            <code className="text-sky-100 text-xs break-all flex-1 font-mono">{currentUserId}</code>
                            <button
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard.writeText(currentUserId);
                                    toast.success('Guest ID copied');
                                }}
                                className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white"
                                title="Copy guest ID"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            sessionStorage.removeItem(guestSessionStorageKey(roomId));
                            setGuestWaitingForApproval(false);
                            setShowGuestEntry(true);
                            setCurrentUserId('');
                            setCurrentUserName('');
                        }}
                        className="text-white/55 hover:text-white text-sm"
                    >
                        Cancel
                    </button>
                </motion.div>
            </MeetingStudioFrame>
        );
    }

    // Guest entry screen
    if (showGuestEntry) {
        const joinAsGuest = async () => {
            if (!guestName.trim() || !meeting?.id) return;
            setGuestRejectedReason(null);

            // Public / general link meetings: guests always submit a join request (not only when require_approval is checked).
            const guestMustWaitForApproval = meeting.access_type === 'general';

            if (guestMustWaitForApproval) {
                const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                const { error } = await supabase.from('meeting_guest_requests').insert({
                    meeting_id: meeting.id,
                    guest_id: guestId,
                    display_name: guestName.trim(),
                    status: 'pending',
                });
                if (error) {
                    toast.error(error.message || 'Could not submit join request');
                    return;
                }
                setCurrentUserId(guestId);
                setCurrentUserName(guestName.trim());
                setCurrentUserRole('Guest');
                sessionStorage.setItem(
                    guestSessionStorageKey(roomId),
                    JSON.stringify({
                        guestId,
                        displayName: guestName.trim(),
                        waiting: true,
                    }),
                );
                setShowGuestEntry(false);
                setGuestWaitingForApproval(true);
                return;
            }

            setShowGuestEntry(false);
            setLoading(true);
            setCurrentUserId(`guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
            setCurrentUserName(guestName.trim());
            setCurrentUserRole('Guest');
            const stream = await acquireMeetingMedia();
            if (stream) {
                setLocalStream(stream);
                const flags = mediaEnabledFlags(stream);
                setIsMuted(flags.muted);
                setIsCameraOff(flags.cameraOff);
            }
            setLoading(false);
        };

        return (
            <MeetingStudioFrame className="min-h-[100dvh] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl shadow-2xl"
                >
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sky-400/15 border border-sky-300/20">
                        <UserCircle className="w-8 h-8 text-sky-200" />
                    </div>
                    <h2 className="text-2xl font-semibold text-white mb-2">Join as a guest</h2>
                    <p className="text-sky-100/80 text-sm mb-2">{meeting?.title}</p>
                    {guestRejectedReason ? (
                        <p className="text-rose-200 text-xs mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2">{guestRejectedReason}</p>
                    ) : null}
                    <p className="text-white/55 text-sm mb-5">
                        Enter the name others should see.
                        {meeting?.access_type === 'general' ? ' The host will approve you before you enter.' : ''}
                    </p>
                    <input
                        type="text"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && joinAsGuest()}
                        placeholder="Your name"
                        autoFocus
                        className="w-full px-4 py-3 rounded-2xl bg-slate-950/50 border border-white/15 text-white placeholder-white/35 outline-none focus:border-sky-300 mb-4 text-center"
                    />
                    <button
                        type="button"
                        onClick={joinAsGuest}
                        disabled={!guestName.trim()}
                        className="w-full rounded-2xl bg-white text-slate-900 py-3 text-sm font-semibold hover:bg-sky-50 transition disabled:opacity-40"
                    >
                        Continue
                    </button>
                    <p className="text-white/45 text-xs mt-4">
                        <Link href={`/login?next=${encodeURIComponent(`/meet/${roomId}`)}`} className="text-sky-200 hover:text-white">
                            Sign in
                        </Link>
                        {' '}if you have a portal account
                    </p>
                </motion.div>
            </MeetingStudioFrame>
        );
    }

    if (accessDenied || !meeting) {
        return (
            <MeetingStudioFrame className="min-h-[100dvh] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl shadow-2xl"
                >
                    <ShieldAlert className="w-12 h-12 text-rose-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold text-white mb-2">You can’t join this room</h2>
                    <p className="text-white/55 text-sm mb-6">
                        Only invited participants and the meeting creator can enter.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/meetings')}
                        className="w-full rounded-2xl bg-white text-slate-900 py-3 text-sm font-semibold hover:bg-sky-50 transition"
                    >
                        Back to meetings
                    </button>
                </motion.div>
            </MeetingStudioFrame>
        );
    }

    if (!hasJoinedMeeting) {
        return (
            <MeetingStudioFrame className="min-h-[100dvh] flex flex-col">
                <header className="flex items-center justify-between px-5 sm:px-8 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <DynamicLogo width={32} height={32} />
                        <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/70">Ready to join</p>
                            <h1 className="text-white text-lg sm:text-xl font-semibold truncate">{meeting.title ?? 'Meeting'}</h1>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/meetings')}
                        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                    >
                        Back
                    </button>
                </header>
                <div className="flex-1 flex items-center justify-center px-4 pb-10">
                    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6 items-center">
                        <div className="meet-tile relative aspect-video">
                            {localStream ? (
                                <>
                                    <video
                                        ref={preJoinVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className={`w-full h-full object-cover ${isCameraOff ? 'opacity-0 absolute inset-0 pointer-events-none' : ''}`}
                                        style={{ transform: 'scaleX(-1)' }}
                                    />
                                    {isCameraOff && (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-900">
                                            <CameraOffAvatar
                                                name={currentUserName || 'You'}
                                                profileImageUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                                isGuest={currentUserId.startsWith('guest-')}
                                                showCameraOffBadge={false}
                                            />
                                            <p className="text-white/60 text-sm">Camera is off</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                    <CameraOffAvatar
                                        name={currentUserName || 'You'}
                                        profileImageUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                        isGuest={currentUserId.startsWith('guest-')}
                                        showCameraOffBadge={false}
                                    />
                                    <p className="text-white/60 text-sm">Turn on camera to preview</p>
                                </div>
                            )}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={toggleMute}
                                    className={`h-12 w-12 rounded-full flex items-center justify-center ${isMuted ? 'bg-white text-rose-600' : 'bg-slate-950/70 text-white border border-white/15'}`}
                                    title={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={toggleCamera}
                                    className={`h-12 w-12 rounded-full flex items-center justify-center ${isCameraOff ? 'bg-white text-rose-600' : 'bg-slate-950/70 text-white border border-white/15'}`}
                                    title={isCameraOff ? 'Start camera' : 'Stop camera'}
                                >
                                    {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-xl">
                            <p className="text-white text-xl font-semibold mb-1">Ready when you are</p>
                            <p className="text-white/55 text-sm mb-5">Check your camera and mic, then join.</p>
                            <div className="mb-5">
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div className={`h-full rounded-full ${micLevel > 70 ? 'bg-emerald-300' : micLevel > 35 ? 'bg-sky-300' : 'bg-white/40'}`} style={{ width: `${isMuted ? 0 : micLevel}%` }} />
                                </div>
                                <p className="text-xs text-white/45 mt-2">{isMuted ? 'Mic is muted' : 'Speak to test your microphone'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        void (async () => {
                                            setSpeakerOn(true);
                                            await applySpeakerOutput(true, { playChime: true });
                                        })();
                                    }}
                                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
                                >
                                    Test speaker
                                </button>
                                {!localStream && (
                                    <button type="button" onClick={() => void ensureLocalMedia()} className="rounded-full bg-sky-400/20 border border-sky-300/30 px-4 py-2 text-xs text-sky-100">
                                        Enable camera & mic
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    void (async () => {
                                        await unlockMeetingAudioPlayback();
                                        const stream = await ensureLocalMedia();
                                        if (!stream) {
                                            toast.error(`Allow camera and microphone so others can see and hear you. ${macMediaPermissionHint()}`);
                                        }
                                        setSpeakerOn(true);
                                        await applySpeakerOutput(true);
                                        setHasJoinedMeeting(true);
                                    })();
                                }}
                                className="w-full rounded-2xl bg-white text-slate-900 py-3.5 text-sm font-semibold hover:bg-sky-50 transition"
                            >
                                Join now
                            </button>
                        </div>
                    </div>
                </div>
            </MeetingStudioFrame>
        );
    }

    const screenShareApiAvailable =
        typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';

    const openSidePanel = (which: 'chat' | 'people' | 'approvals' | 'info') => {
        setIsMoreOpen(false);
        setIsChatOpen(which === 'chat');
        setIsParticipantListOpen(which === 'people');
        setIsApprovalsOpen(which === 'approvals');
        setIsInfoOpen(which === 'info');
    };

    const closeSidePanel = () => {
        setIsChatOpen(false);
        setIsParticipantListOpen(false);
        setIsApprovalsOpen(false);
        setIsInfoOpen(false);
    };

    const toggleSidePanel = (which: 'chat' | 'people' | 'approvals' | 'info') => {
        const alreadyOpen =
            (which === 'chat' && isChatOpen) ||
            (which === 'people' && isParticipantListOpen) ||
            (which === 'approvals' && isApprovalsOpen) ||
            (which === 'info' && isInfoOpen);
        if (alreadyOpen) {
            closeSidePanel();
            setIsMoreOpen(false);
            return;
        }
        openSidePanel(which);
    };

    const copyMeetingLink = () => {
        const link = `${window.location.origin}/meet/${roomId}`;
        void navigator.clipboard.writeText(link);
        toast.success('Meeting link copied');
        setIsMoreOpen(false);
    };

    const sidePanelOpen = isChatOpen || isParticipantListOpen || isApprovalsOpen || isInfoOpen;
    const remotePeerCount = peers.size;

    const mainControls = [
        {
            icon: isMuted ? MicOff : Mic,
            label: isMuted ? 'Unmute' : 'Mute',
            onClick: toggleMute,
            active: !isMuted,
            danger: isMuted,
            dimmed: false,
        },
        {
            icon: isCameraOff ? VideoOff : Video,
            label: isCameraOff ? 'Start camera' : 'Stop camera',
            onClick: toggleCamera,
            active: !isCameraOff,
            danger: isCameraOff,
            dimmed: false,
        },
        {
            icon: MonitorUp,
            label: isScreenSharing ? 'Stop sharing' : 'Share screen',
            onClick: () => { void toggleScreenShare(); },
            active: isScreenSharing,
            danger: false,
            dimmed: !screenShareApiAvailable && !isScreenSharing,
        },
    ];

    const moreItems = [
        {
            icon: speakerOn ? Speaker : Volume2,
            label: speakerOn ? 'Speaker' : 'Earpiece',
            onClick: toggleSpeaker,
            danger: false,
        },
        {
            icon: MessageSquare,
            label: isChatOpen ? 'Close chat' : 'Chat',
            onClick: () => toggleSidePanel('chat'),
            danger: false,
        },
        {
            icon: Users,
            label: `Participants (${participants.length})`,
            onClick: () => toggleSidePanel('people'),
            danger: false,
        },
        {
            icon: Info,
            label: isInfoOpen ? 'Close details' : 'Meeting details',
            onClick: () => toggleSidePanel('info'),
            danger: false,
        },
        {
            icon: Link2,
            label: 'Copy meeting link',
            onClick: copyMeetingLink,
            danger: false,
        },
        ...(canApproveRequests ? [{
            icon: Check,
            label: `Approvals (${pendingRequests.length})`,
            onClick: () => openSidePanel('approvals'),
            danger: false,
        }] : []),
        ...(canModerateMeetingRoom ? [
            {
                icon: MicOff,
                label: 'Mute everyone',
                onClick: () => {
                    const policy = meeting?.created_by === currentUserId ? 'creator' : 'ec_faculty';
                    sendRoomControl('mute-all', undefined, { mutePolicy: policy });
                    toast.success(
                        policy === 'creator'
                            ? 'Sent: mute (EC & faculty exempt)'
                            : 'Sent: mute (meeting creator exempt)',
                    );
                    setIsMoreOpen(false);
                },
                danger: true,
            },
            {
                icon: Volume2,
                label: 'Allow unmute',
                onClick: () => {
                    sendRoomControl('allow-unmute');
                    toast.success('Sent: everyone can unmute');
                    setIsMoreOpen(false);
                },
                danger: false,
            },
        ] : []),
    ];

    const moreHasAlert = canApproveRequests && pendingRequests.length > 0;

    return (
        <MeetingStudioFrame className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden">
            <div className="relative flex h-[100dvh] min-h-0 flex-col" onPointerDown={() => { void unlockMeetingAudioPlayback(); }}>
                <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <MeetingClock />
                        <span className="hidden h-4 w-px bg-white/15 sm:block" />
                        <DynamicLogo width={26} height={26} />
                        <div className="min-w-0">
                            <h1 className="truncate text-sm font-semibold text-white">{meeting.title ?? 'Meeting'}</h1>
                            <p className="hidden text-[11px] text-white/45 sm:block">
                                IIChE AVVU SC · {formatDurationSeconds(meetingSessionDisplaySec)}
                            </p>
                        </div>
                        {isScreenSharing ? (
                            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                Sharing screen
                            </span>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => toggleSidePanel('info')}
                            className={`hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 ${isInfoOpen ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title="Meeting details"
                            aria-label="Meeting details"
                        >
                            <Info className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleSidePanel('people')}
                            className={`inline-flex h-10 items-center gap-1.5 rounded-full border border-white/10 px-3 ${isParticipantListOpen ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title="Participants"
                        >
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-semibold">{participants.length}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleSidePanel('chat')}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 ${isChatOpen ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title="Chat"
                            aria-label="Chat"
                        >
                            <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={copyMeetingLink}
                            className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20"
                            title="Copy meeting link"
                            aria-label="Copy meeting link"
                        >
                            <Link2 className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                <div className="relative z-10 flex min-h-0 flex-1 gap-3 px-3 pb-[5.75rem] pt-1">
                    <div className="relative min-h-0 min-w-0 flex-1">
                        {pinnedPeerId ? (
                            <div className="flex h-full min-h-0 flex-col gap-2">
                                <div className="min-h-0 flex-1">
                                    {pinnedPeerId === 'local' ? (
                                        <InCallLocalTile
                                            videoKey={localVideoRenderKey}
                                            stream={localPreviewStream || localStream}
                                            isCameraOff={isCameraOff}
                                            isScreenSharing={isScreenSharing}
                                            displayName={currentUserName || 'You'}
                                            profileAvatarUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                            userId={currentUserId}
                                            userRole={currentUserRole}
                                            isMuted={isMuted}
                                            variant="stage"
                                            pinned
                                            onPin={() => setPinnedPeerId(null)}
                                        />
                                    ) : peers.has(pinnedPeerId) ? (
                                        <RemoteVideo
                                            peer={peers.get(pinnedPeerId)!}
                                            peerId={userIdFromPeerId(pinnedPeerId)}
                                            presenceRole={peerRawRoleByUserId.get(userIdFromPeerId(pinnedPeerId))}
                                            profileAvatarUrl={peerAvatarUrls[userIdFromPeerId(pinnedPeerId)] ?? null}
                                            peerSignalsCameraOff={peerCameraSendingVideo[pinnedPeerId] === false}
                                            outputDeviceId={speakerOutputId}
                                            isPinned={true}
                                            onPin={() => setPinnedPeerId(null)}
                                        />
                                    ) : null}
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {pinnedPeerId !== 'local' ? (
                                        <InCallLocalTile
                                            videoKey={localVideoRenderKey}
                                            stream={localPreviewStream || localStream}
                                            isCameraOff={isCameraOff}
                                            isScreenSharing={isScreenSharing}
                                            displayName={currentUserName || 'You'}
                                            profileAvatarUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                            userId={currentUserId}
                                            userRole={currentUserRole}
                                            isMuted={isMuted}
                                            variant="strip"
                                            onPin={() => setPinnedPeerId('local')}
                                        />
                                    ) : null}
                                    {Array.from(peers.entries()).filter(([pid]) => pid !== pinnedPeerId).map(([pid, peer]) => (
                                        <RemoteVideo
                                            key={pid}
                                            peer={peer}
                                            peerId={userIdFromPeerId(pid)}
                                            presenceRole={peerRawRoleByUserId.get(userIdFromPeerId(pid))}
                                            profileAvatarUrl={peerAvatarUrls[userIdFromPeerId(pid)] ?? null}
                                            peerSignalsCameraOff={peerCameraSendingVideo[pid] === false}
                                            outputDeviceId={speakerOutputId}
                                            isPinned={false}
                                            onPin={() => setPinnedPeerId(pid)}
                                            small
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : remotePeerCount === 0 ? (
                            <InCallLocalTile
                                videoKey={localVideoRenderKey}
                                stream={localPreviewStream || localStream}
                                isCameraOff={isCameraOff}
                                isScreenSharing={isScreenSharing}
                                displayName={currentUserName || 'You'}
                                profileAvatarUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                userId={currentUserId}
                                userRole={currentUserRole}
                                isMuted={isMuted}
                                variant="stage"
                                onPin={() => setPinnedPeerId('local')}
                            />
                        ) : (
                            <>
                                <div className={`grid h-full min-h-0 gap-3 auto-rows-[minmax(0,1fr)] ${remotePeerCount <= 1 ? 'grid-cols-1' : remotePeerCount === 2 ? 'grid-cols-1 md:grid-cols-2' : remotePeerCount <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
                                    {Array.from(peers.entries()).map(([pid, peer]) => (
                                        <RemoteVideo
                                            key={pid}
                                            peer={peer}
                                            peerId={userIdFromPeerId(pid)}
                                            presenceRole={peerRawRoleByUserId.get(userIdFromPeerId(pid))}
                                            profileAvatarUrl={peerAvatarUrls[userIdFromPeerId(pid)] ?? null}
                                            peerSignalsCameraOff={peerCameraSendingVideo[pid] === false}
                                            outputDeviceId={speakerOutputId}
                                            isPinned={false}
                                            onPin={() => setPinnedPeerId(pid)}
                                        />
                                    ))}
                                </div>
                                <div className="absolute bottom-3 right-3 z-20 w-[min(42%,17rem)]">
                                    <InCallLocalTile
                                        videoKey={localVideoRenderKey}
                                        stream={localPreviewStream || localStream}
                                        isCameraOff={isCameraOff}
                                        isScreenSharing={isScreenSharing}
                                        displayName={currentUserName || 'You'}
                                        profileAvatarUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                        userId={currentUserId}
                                        userRole={currentUserRole}
                                        isMuted={isMuted}
                                        variant="pip"
                                        onPin={() => setPinnedPeerId('local')}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <AnimatePresence>
                        {sidePanelOpen && (
                            <motion.aside
                                initial={{ x: 28, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 28, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="meet-panel absolute inset-x-0 top-0 bottom-[5.75rem] z-30 flex w-full flex-col overflow-hidden rounded-3xl sm:static sm:inset-auto sm:bottom-auto sm:w-[360px] sm:shrink-0"
                            >
                                <div className="flex border-b border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => openSidePanel('info')}
                                        className={`flex-1 py-3 text-[11px] font-semibold transition-colors ${isInfoOpen ? 'text-sky-200 border-b-2 border-sky-300' : 'text-white/40 hover:text-white/70'}`}
                                    >
                                        Info
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openSidePanel('chat')}
                                        className={`flex-1 py-3 text-[11px] font-semibold transition-colors ${isChatOpen ? 'text-sky-200 border-b-2 border-sky-300' : 'text-white/40 hover:text-white/70'}`}
                                    >
                                        Chat
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openSidePanel('people')}
                                        className={`flex-1 py-3 text-[11px] font-semibold transition-colors ${isParticipantListOpen ? 'text-sky-200 border-b-2 border-sky-300' : 'text-white/40 hover:text-white/70'}`}
                                    >
                                        People ({participants.length})
                                    </button>
                                    {canApproveRequests && (
                                        <button
                                            type="button"
                                            onClick={() => openSidePanel('approvals')}
                                            className={`flex-1 py-3 text-[11px] font-semibold transition-colors ${isApprovalsOpen ? 'text-sky-200 border-b-2 border-sky-300' : 'text-white/40 hover:text-white/70'}`}
                                        >
                                            In ({pendingRequests.length})
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={closeSidePanel}
                                        className="px-3 text-white/40 hover:text-white/80"
                                        title="Close panel"
                                        aria-label="Close panel"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {isChatOpen ? (
                                    <ChatPanel
                                        messages={chatMessages}
                                        currentUserId={currentUserId}
                                        onSend={sendChatMessage}
                                        uploadMeetingFile={uploadMeetingChatFile}
                                    />
                                ) : isParticipantListOpen ? (
                                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                                        <div className="p-3 border-b border-white/10 space-y-2 shrink-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-white/50 text-[10px] uppercase tracking-wide">Room session</p>
                                                <div className="text-right">
                                                    {othersPresentCount === 0 ? (
                                                        <span className="text-sky-200/90 text-[10px] font-semibold mr-2">Paused</span>
                                                    ) : null}
                                                    <span className="text-emerald-300 text-sm font-mono font-semibold tabular-nums">
                                                        {formatDurationSeconds(meetingSessionDisplaySec)}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-white/35 text-[10px] leading-snug">
                                                Time accrues while someone else is in the room; it pauses when you are the only one connected.
                                            </p>
                                            {canModerateMeetingRoom ? (
                                                <>
                                                    {liveSessionSaveGate === 'blocked' ? (
                                                        <p className="text-sky-100/85 text-[10px] leading-snug border border-sky-400/25 rounded-lg px-2 py-1.5 bg-sky-500/10">
                                                            Finalize attendance on the dashboard meeting page first. This room will pick it up automatically (or refresh the page). Then you can save session time to the meeting record.
                                                        </p>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => void saveLiveSessionToMeeting()}
                                                        disabled={
                                                            savingLiveSession ||
                                                            liveSessionSaveGate === 'loading' ||
                                                            liveSessionSaveGate === 'blocked'
                                                        }
                                                        className="w-full py-2 rounded-lg text-[11px] font-semibold bg-sky-500/20 text-sky-100 border border-sky-400/35 hover:bg-sky-500/30 disabled:opacity-50"
                                                    >
                                                        {savingLiveSession
                                                            ? 'Saving…'
                                                            : liveSessionSaveGate === 'loading'
                                                              ? 'Checking attendance…'
                                                              : 'Save session time to meeting record'}
                                                    </button>
                                                </>
                                            ) : null}
                                            {meeting?.live_session_finalized_at ? (
                                                <p className="text-white/50 text-[10px]">
                                                    A session duration was saved for this meeting (see meeting details).
                                                </p>
                                            ) : null}
                                        </div>
                                        <ParticipantsPanel
                                            participants={participants}
                                            peers={peers}
                                            relayAvailable={relayAvailable}
                                            currentUserId={currentUserId}
                                            currentPeerId={selfPeerId}
                                            canModerateMeetingRoom={canModerateMeetingRoom}
                                            meetingCreatorId={meeting?.created_by ?? null}
                                            selfUnmuteLocked={selfUnmuteLocked}
                                            selfLiveTotalFromDb={selfLiveTotalFromDb}
                                            sessionSegmentStartMs={sessionSegmentStartRef.current}
                                            onAllowUnmutePeer={(userId) => {
                                                sendRoomControl('allow-unmute-peer', userId);
                                                toast.success('Sent unmute to participant');
                                            }}
                                            onKickPeer={(userId) => {
                                                sendRoomControl('kick-peer', userId);
                                                toast.success('Removal sent');
                                            }}
                                        />
                                    </div>
                                ) : isApprovalsOpen ? (
                                    <ApprovalsPanel
                                        pendingRequests={pendingRequests}
                                        processingApprovalKey={processingApprovalKey}
                                        onApprove={async (req) => {
                                            if (!meeting?.id) return;
                                            setProcessingApprovalKey(req.key);
                                            try {
                                                if (req.requestKind === 'member') {
                                                    await supabase.from('meeting_participants').update({ rsvp_status: 'approved' }).eq('meeting_id', meeting.id).eq('user_id', req.user_id);
                                                } else {
                                                    await supabase.from('meeting_guest_requests').update({ status: 'approved' }).eq('id', req.rowId).eq('meeting_id', meeting.id);
                                                }
                                            } finally {
                                                setProcessingApprovalKey(null);
                                                void loadPendingRequests();
                                            }
                                        }}
                                        onReject={async (req) => {
                                            if (!meeting?.id) return;
                                            setProcessingApprovalKey(req.key);
                                            try {
                                                if (req.requestKind === 'member') {
                                                    await supabase.from('meeting_participants').update({ rsvp_status: 'rejected' }).eq('meeting_id', meeting.id).eq('user_id', req.user_id);
                                                } else {
                                                    await supabase.from('meeting_guest_requests').update({ status: 'rejected' }).eq('id', req.rowId).eq('meeting_id', meeting.id);
                                                }
                                            } finally {
                                                setProcessingApprovalKey(null);
                                                void loadPendingRequests();
                                            }
                                        }}
                                    />
                                ) : (
                                    <MeetingDetailsPanel
                                        meeting={meeting}
                                        participants={participants}
                                        currentUserId={currentUserId}
                                        localStream={localStream}
                                        currentUserName={currentUserName}
                                        isMuted={isMuted}
                                    />
                                )}
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-3">
                    <div className="meet-dock pointer-events-auto flex items-center gap-2 rounded-full px-2.5 py-2">
                        {mainControls.map((ctrl) => (
                            <MeetDockButton
                                key={ctrl.label}
                                icon={ctrl.icon}
                                label={ctrl.dimmed ? `${ctrl.label} (not supported on this device)` : ctrl.label}
                                onClick={ctrl.onClick}
                                dimmed={ctrl.dimmed}
                                tone={ctrl.danger ? 'off' : ctrl.active && ctrl.label === 'Stop sharing' ? 'active' : 'default'}
                            />
                        ))}
                        <div className="relative">
                            <MeetDockButton
                                icon={Ellipsis}
                                label="More"
                                onClick={() => setIsMoreOpen((prev) => !prev)}
                                alert={moreHasAlert && !isMoreOpen}
                            />
                            <AnimatePresence>
                                {isMoreOpen && (
                                    <>
                                        <button
                                            type="button"
                                            className="fixed inset-0 z-[60]"
                                            aria-label="Close more menu"
                                            onClick={() => setIsMoreOpen(false)}
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 8 }}
                                            className="absolute bottom-full mb-2 right-0 z-[70] w-[min(100vw-1.5rem,240px)] rounded-2xl border border-white/10 bg-slate-950/95 p-1.5 shadow-xl"
                                        >
                                            {moreItems.map((item) => (
                                                <button
                                                    key={item.label}
                                                    type="button"
                                                    onClick={item.onClick}
                                                    className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${
                                                        item.danger
                                                            ? 'text-rose-300 hover:bg-rose-500/15'
                                                            : 'text-white/85 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <item.icon className="w-4 h-4 shrink-0" />
                                                    <span className="truncate">{item.label}</span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                        <MeetDockButton icon={LogOut} label="Leave" onClick={leaveMeeting} tone="leave" wide />
                    </div>
                </div>
            </div>
        </MeetingStudioFrame>
    );
}

function isRemoteMeetingGuest(peerId: string, userRole: string | null | undefined) {
    return peerId.startsWith('guest-') || userRole === 'Guest';
}

/** Role chip on video tiles — portal roles + Guest for link guests. Camera on or off. */
function RemoteVideoRoleBadge({
    peerId,
    userRole,
    className = '',
    compact,
}: {
    peerId: string;
    userRole: string | null | undefined;
    className?: string;
    compact?: boolean;
}) {
    const role = normalizeMeetingRoleLabel(userRole);
    if (isRemoteMeetingGuest(peerId, role)) {
        const sizeCls = compact ? 'text-[8px] px-1 py-0.5' : 'text-[9px] px-1.5 py-0.5';
        return (
            <span className={`${sizeCls} rounded-full font-semibold shrink-0 bg-gray-500/30 text-gray-300 ${className}`.trim()}>👤 Guest</span>
        );
    }
    if (!role) return null;
    const spanCls =
        role === 'Executive' ? 'bg-yellow-500/30 text-yellow-300' :
            role === 'Faculty' ? 'bg-amber-500/30 text-amber-300' :
                role === 'Head' ? 'bg-blue-500/30 text-blue-200' :
                    role === 'Co-Head' ? 'bg-cyan-500/30 text-cyan-200' :
                        role === 'Admin' ? 'bg-red-500/30 text-red-300' :
                            'bg-amber-400/30 text-amber-200';
    const label =
        role === 'Executive' ? '👑 Executive' :
            role === 'Faculty' ? '🎓 Faculty' :
                role === 'Head' ? '🧭 Head' :
                    role === 'Co-Head' ? '📍 Co-Head' :
                        role === 'Admin' ? '🛡️ Admin' :
                            `👑 ${role}`;
    const sizeCls = compact ? 'text-[8px] px-1 py-0.5' : 'text-[9px] px-1.5 py-0.5';
    return <span className={`${sizeCls} rounded-full font-semibold shrink-0 ${spanCls} ${className}`.trim()}>{label}</span>;
}

// Separate component for remote video to manage its own ref
function RemoteVideo({
    peer,
    peerId,
    presenceRole,
    profileAvatarUrl,
    peerSignalsCameraOff = false,
    outputDeviceId = null,
    isPinned,
    onPin,
    small,
}: {
    peer: PeerState;
    peerId: string;
    presenceRole: string | null | undefined;
    profileAvatarUrl: string | null;
    /** Room broadcast says this peer turned camera off — show avatar for everyone (WebRTC often keeps a live unmuted-looking track). */
    peerSignalsCameraOff?: boolean;
    outputDeviceId?: string | null;
    isPinned: boolean;
    onPin: () => void;
    small?: boolean;
}) {
    const isGuestPeer = peerId.startsWith('guest-');
    const remoteDisplayName = String(peer.userName ?? '').trim() || 'Participant';
    const videoRef = useRef<HTMLVideoElement>(null);
    /** Decoded frames visible in the &lt;video&gt; element (not only RTP flowing). */
    const [hasVideo, setHasVideo] = useState(false);
    const [isRemoteScreenShare, setIsRemoteScreenShare] = useState(false);

    // `remoteStream` is a stable MediaStream instance; tracks are added later in ontrack.
    // Depending only on peer.remoteStream skips re-binding the <video> when tracks appear.
    // Track ids only — mute/readyState changes are handled inside the effect (avoid tearing down on every mute).
    const remoteStreamTrackKey = peer.remoteStream?.getVideoTracks().map((t) => t.id).join('|') ?? '';

    useEffect(() => {
        const stream = peer.remoteStream;
        if (!stream) return;

        const videoOnly = new MediaStream(stream.getVideoTracks());
        let lastBlackRecovery = 0;

        const doBumpPlayback = () => {
            const el = videoRef.current;
            if (!el) return;
            if (el.srcObject !== videoOnly) el.srcObject = videoOnly;
            el.muted = true;
            el.playsInline = true;
            void el.play().catch(() => undefined);
            check();
        };

        const check = () => {
            const tracks = stream.getVideoTracks() || [];
            const live = tracks.some((t) => t.readyState === 'live');
            const el = videoRef.current;
            const hasDims = Boolean(el && el.videoWidth > 0 && el.videoHeight > 0);
            setHasVideo(hasDims);
            const sharing = tracks.some((track) => {
                const settings = track.getSettings?.() as MediaTrackSettings | undefined;
                const displaySurface = settings?.displaySurface;
                const label = (track.label || '').toLowerCase();
                return displaySurface === 'monitor' || displaySurface === 'window' || displaySurface === 'browser' || label.includes('screen') || label.includes('window') || label.includes('tab');
            });
            setIsRemoteScreenShare(sharing);

            const now = Date.now();
            if (el && live && el.videoWidth === 0 && now - lastBlackRecovery > 6000) {
                lastBlackRecovery = now;
                void el.play().catch(() => undefined);
            }
        };

        doBumpPlayback();

        const trackCleanups: (() => void)[] = [];
        const attachTrackListeners = (t: MediaStreamTrack) => {
            const onSig = () => doBumpPlayback();
            t.addEventListener('unmute', onSig);
            t.addEventListener('mute', onSig);
            t.addEventListener('ended', onSig);
            trackCleanups.push(() => {
                t.removeEventListener('unmute', onSig);
                t.removeEventListener('mute', onSig);
                t.removeEventListener('ended', onSig);
            });
        };
        stream.getVideoTracks().forEach(attachTrackListeners);

        const onStreamTrackAdded = (e: MediaStreamTrackEvent) => {
            if (e.track?.kind === 'video') {
                if (!videoOnly.getTracks().some((t) => t.id === e.track.id)) videoOnly.addTrack(e.track);
                attachTrackListeners(e.track);
            }
            doBumpPlayback();
            check();
        };
        const onStreamTrackRemoved = () => {
            doBumpPlayback();
            check();
        };
        stream.addEventListener('addtrack', onStreamTrackAdded);
        stream.addEventListener('removetrack', onStreamTrackRemoved);

        const interval = setInterval(check, 800);
        check();

        return () => {
            clearInterval(interval);
            stream.removeEventListener('addtrack', onStreamTrackAdded);
            stream.removeEventListener('removetrack', onStreamTrackRemoved);
            trackCleanups.forEach((fn) => fn());
            const el = videoRef.current;
            if (el) el.srcObject = null;
        };
    }, [peer.remoteStream, remoteStreamTrackKey]);

    const liveVideoTrack = Boolean(
        peer.remoteStream?.getVideoTracks().some((t) => t.readyState === 'live'),
    );
    const mediaConnected = peer.connectionState === 'connected';
    const forceAvatarUi = peerSignalsCameraOff && !isRemoteScreenShare && mediaConnected;
    const showLivePixels = hasVideo && !forceAvatarUi;
    const showConnectingUi = !forceAvatarUi && !mediaConnected && peer.connectionState !== 'failed';
    const showCameraOffChrome = forceAvatarUi || (mediaConnected && !hasVideo && !liveVideoTrack && !isRemoteScreenShare);

    if (small) {
        return (
            <div className="meet-tile relative w-40 h-24 flex-shrink-0 cursor-pointer group" onClick={onPin}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    data-meeting-remote="1"
                    className="absolute inset-0 w-full h-full object-cover min-h-0"
                    style={{ display: forceAvatarUi ? 'none' : 'block', opacity: 1 }}
                />
                {showConnectingUi && (
                    <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-slate-950/90">
                        <CameraOffAvatar name={remoteDisplayName} profileImageUrl={profileAvatarUrl} compact isGuest={isGuestPeer} />
                        <p className="text-[8px] text-white/55 uppercase tracking-wide mt-0.5">
                            {peer.connectionState === 'failed' ? 'Reconnect…' : 'Connecting…'}
                        </p>
                    </div>
                )}
                {showCameraOffChrome && (
                    <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-slate-950/90">
                        <CameraOffAvatar
                            name={remoteDisplayName}
                            profileImageUrl={profileAvatarUrl}
                            compact
                            isGuest={isGuestPeer}
                        />
                        <p className="text-[8px] text-white/45 uppercase tracking-wide mt-0.5">Camera off</p>
                    </div>
                )}
                {peer.remoteStream && <AudioPlayer stream={peer.remoteStream} outputDeviceId={outputDeviceId} />}
                {isRemoteScreenShare && <div className="absolute top-1 left-1 rounded-md border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5"><p className="text-[9px] text-emerald-200 font-semibold">Sharing</p></div>}
                {showLivePixels && <div className="absolute top-1 right-1 z-[1]"><RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} compact /></div>}
                <div className="absolute bottom-1 left-1 right-8 meet-nameplate rounded px-1.5 py-0.5 flex items-center gap-1.5 flex-wrap min-w-0">
                    <p className="text-white text-[10px] truncate">{remoteDisplayName}</p>
                    {!showLivePixels ? <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} compact /> : null}
                </div>
            </div>
        );
    }

    return (
        <div className={`meet-tile relative ${isPinned ? 'w-full h-full' : 'h-full min-h-0'} group`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                data-meeting-remote="1"
                className="absolute inset-0 w-full h-full object-cover min-h-0"
                style={{ display: forceAvatarUi ? 'none' : 'block', opacity: 1 }}
            />
            {showConnectingUi && (
                <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 px-4 bg-slate-950/90">
                    <CameraOffAvatar name={remoteDisplayName} profileImageUrl={profileAvatarUrl} isGuest={isGuestPeer} />
                    <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} className="text-[10px] px-2.5 py-1" />
                    <p className="text-[10px] text-white/55 uppercase tracking-widest">
                        {peer.connectionState === 'failed' ? 'Connection failed' : 'Connecting video…'}
                    </p>
                    <p className="text-white/85 text-sm font-medium">{remoteDisplayName}</p>
                </div>
            )}
            {showCameraOffChrome && (
                <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 px-4 bg-slate-950/90">
                    <CameraOffAvatar name={remoteDisplayName} profileImageUrl={profileAvatarUrl} isGuest={isGuestPeer} />
                    <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} className="text-[10px] px-2.5 py-1" />
                    <p className="text-[10px] text-white/45 uppercase tracking-widest">Camera off</p>
                    <p className="text-white/85 text-sm font-medium">{remoteDisplayName}</p>
                </div>
            )}
            {peer.remoteStream && <AudioPlayer stream={peer.remoteStream} outputDeviceId={outputDeviceId} />}
            {isRemoteScreenShare && <div className="absolute top-3 left-3 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 z-[1]"><p className="text-[10px] text-emerald-200 font-semibold">Sharing screen</p></div>}
            {showLivePixels && (
                <div className="absolute bottom-3 left-3 right-14 meet-nameplate rounded-lg px-3 py-1.5 flex items-center gap-2 flex-wrap max-w-[min(100%,22rem)]">
                    <p className="text-white text-xs font-medium truncate">{remoteDisplayName}{isPinned ? ' · Pinned' : ''}</p>
                    <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} compact />
                </div>
            )}
            <button type="button" onClick={onPin} className="absolute top-3 right-3 bg-white/10 rounded-full p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity z-[2]" title={isPinned ? 'Unpin' : 'Pin'}>
                {isPinned ? <PinOff className="w-3 h-3 text-white" /> : <Pin className="w-3 h-3 text-white" />}
            </button>
        </div>
    );
}

// Separate audio element to guarantee audio playback even when video is muted/hidden.
// Do not use `hidden`/`display:none` — Chrome and Safari often refuse to play those.
function AudioPlayer({ stream, outputDeviceId }: { stream: MediaStream; outputDeviceId?: string | null }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioTrackKey = stream.getAudioTracks().map((t) => `${t.id}:${t.readyState}:${t.muted}`).join('|');

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        // Never attach the same MediaStream to both <video> and <audio> — Safari drops playback.
        const audioOnly = new MediaStream(stream.getAudioTracks());
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        el.muted = false;
        el.volume = 1;
        el.srcObject = audioOnly;
        const tryPlay = async () => {
            el.muted = false;
            el.volume = 1;
            await applyAudioOutputToElement(el, outputDeviceId);
            try {
                await el.play();
            } catch {
                /* Join click should have unlocked autoplay; retry once. */
                window.setTimeout(() => void el.play().catch(() => undefined), 250);
            }
        };
        void tryPlay();

        const onAdd = (e: MediaStreamTrackEvent) => {
            if (e.track?.kind !== 'audio') return;
            if (!audioOnly.getTracks().some((t) => t.id === e.track.id)) audioOnly.addTrack(e.track);
            tryPlay();
        };
        stream.addEventListener('addtrack', onAdd);

        const trackCleanups: (() => void)[] = [];
        for (const t of stream.getAudioTracks()) {
            const onUnmute = () => tryPlay();
            t.addEventListener('unmute', onUnmute);
            trackCleanups.push(() => t.removeEventListener('unmute', onUnmute));
        }

        return () => {
            stream.removeEventListener('addtrack', onAdd);
            trackCleanups.forEach((fn) => fn());
            disconnectRemoteStreamFromSpeaker(stream.id);
            el.srcObject = null;
        };
    }, [stream, audioTrackKey, outputDeviceId]);

    return (
        <audio
            ref={audioRef}
            data-meeting-remote="1"
            autoPlay
            playsInline
            controls={false}
            style={{
                position: 'fixed',
                left: 8,
                bottom: 8,
                width: 32,
                height: 32,
                opacity: 0.02,
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
}

function LocalVideoTile({
    stream,
    isCameraOff,
    isScreenSharing = false,
    compact = false,
    displayName = 'You',
    profileAvatarUrl = null,
    userId = '',
}: {
    stream: MediaStream | null;
    isCameraOff: boolean;
    isScreenSharing?: boolean;
    compact?: boolean;
    displayName?: string;
    profileAvatarUrl?: string | null;
    /** Used only to detect guest vs portal for avatar styling. Role chip stays on the parent bar. */
    userId?: string;
}) {
    const ref = useRef<HTMLVideoElement>(null);

    const videoTrackKey = stream?.getVideoTracks().map((t) => `${t.id}:${t.enabled}:${t.readyState}`).join('|') ?? '';

    // Keep <video> mounted when a stream exists — unmounting on camera-off breaks Chrome/WebKit after re-enabling the track.
    useEffect(() => {
        const el = ref.current;
        if (!el || !stream) return;

        const bind = () => {
            bindLocalPreviewVideo(el, stream);
        };
        bind();

        const hasEnabledVideo = !isCameraOff && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
        let attemptsLeft = hasEnabledVideo ? 8 : 0;
        const retry = window.setInterval(() => {
            if (el.videoWidth > 0 || attemptsLeft <= 0) {
                window.clearInterval(retry);
                return;
            }
            attemptsLeft -= 1;
            bind();
        }, 400);

        const cleanups: (() => void)[] = [];
        for (const t of stream.getVideoTracks()) {
            const refresh = () => bind();
            t.addEventListener('unmute', refresh);
            t.addEventListener('ended', refresh);
            cleanups.push(() => {
                t.removeEventListener('unmute', refresh);
                t.removeEventListener('ended', refresh);
            });
        }
        return () => {
            window.clearInterval(retry);
            cleanups.forEach((c) => c());
            el.srcObject = null;
        };
    }, [stream, isScreenSharing, isCameraOff, videoTrackKey]);

    useEffect(() => {
        const el = ref.current;
        if (!el || !stream) return;
        if (isCameraOff && !isScreenSharing) return;
        void el.play().catch(() => undefined);
    }, [isCameraOff, isScreenSharing, stream]);

    const localIsGuest = userId.startsWith('guest-');

    if (!stream) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2">
                <CameraOffAvatar
                    name={displayName}
                    profileImageUrl={profileAvatarUrl}
                    compact={compact}
                    isGuest={localIsGuest}
                    showCameraOffBadge={false}
                />
                {!compact && <p className="text-white/50 text-sm">No camera</p>}
            </div>
        );
    }

    const showCameraOffOverlay = isCameraOff && !isScreenSharing;

    return (
        <div className="relative w-full h-full min-h-0">
            <video
                ref={ref}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${showCameraOffOverlay ? 'opacity-0 absolute inset-0 min-h-0 pointer-events-none' : ''}`}
                style={isScreenSharing ? undefined : { transform: 'scaleX(-1)' }}
            />
            {showCameraOffOverlay && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/90 px-2">
                    <CameraOffAvatar
                        name={displayName}
                        profileImageUrl={profileAvatarUrl}
                        compact={compact}
                        isGuest={localIsGuest}
                        showCameraOffBadge={false}
                    />
                    {!compact && <p className="text-white/50 text-sm">Camera is off</p>}
                </div>
            )}
        </div>
    );
}

function InCallLocalTile({
    videoKey,
    stream,
    isCameraOff,
    isScreenSharing,
    displayName,
    profileAvatarUrl,
    userId,
    userRole,
    isMuted,
    variant,
    pinned = false,
    onPin,
}: {
    videoKey: number;
    stream: MediaStream | null;
    isCameraOff: boolean;
    isScreenSharing: boolean;
    displayName: string;
    profileAvatarUrl: string | null;
    userId: string;
    userRole: string | null;
    isMuted: boolean;
    variant: 'stage' | 'pip' | 'strip';
    pinned?: boolean;
    onPin?: () => void;
}) {
    const compact = variant !== 'stage';
    const wrap =
        variant === 'pip'
            ? 'meet-pip aspect-video'
            : variant === 'strip'
              ? 'meet-tile w-40 h-24 flex-shrink-0 cursor-pointer'
              : 'meet-tile h-full min-h-0 w-full';
    return (
        <div className={`relative overflow-hidden group ${wrap}`} onClick={variant === 'strip' ? onPin : undefined}>
            <LocalVideoTile
                key={`lv-${videoKey}`}
                stream={stream}
                isCameraOff={isCameraOff}
                isScreenSharing={isScreenSharing}
                compact={compact}
                displayName={displayName}
                profileAvatarUrl={profileAvatarUrl}
                userId={userId}
            />
            <div className={`absolute ${variant === 'strip' ? 'bottom-1 left-1 right-8 rounded-md px-1.5 py-0.5' : 'bottom-3 left-3 rounded-lg px-2.5 py-1'} meet-nameplate flex items-center gap-1.5 max-w-[min(100%,18rem)]`}>
                <p className={`text-white font-medium truncate ${variant === 'strip' ? 'text-[10px]' : 'text-xs'}`}>
                    You{pinned ? ' · Pinned' : ''}
                </p>
                {variant !== 'pip' ? <RemoteVideoRoleBadge peerId={userId} userRole={userRole} compact /> : null}
            </div>
            {isMuted ? (
                <div className={`absolute ${variant === 'strip' ? 'top-1 left-1 p-1' : 'top-3 left-3 p-1.5'} rounded-full bg-rose-500`}>
                    <MicOff className="w-3 h-3 text-white" />
                </div>
            ) : null}
            {onPin && variant !== 'strip' ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPin();
                    }}
                    className="absolute top-3 right-3 rounded-full bg-white/10 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/20"
                    title={pinned ? 'Unpin' : 'Pin'}
                >
                    {pinned ? <PinOff className="w-3 h-3 text-white" /> : <Pin className="w-3 h-3 text-white" />}
                </button>
            ) : null}
        </div>
    );
}

// Chat panel component for in-room messaging
function ChatPanel({
    messages,
    currentUserId,
    onSend,
    uploadMeetingFile,
}: {
    messages: ChatMessage[];
    currentUserId: string;
    onSend: (payload: SendChatPayload) => void;
    uploadMeetingFile: (file: File) => Promise<{ url: string; kind: 'image' | 'file'; fileName: string }>;
}) {
    const [input, setInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSend(input.trim());
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const { url, kind, fileName } = await uploadMeetingFile(file);
            const caption = input.trim();
            onSend({
                message: caption || undefined,
                attachmentUrl: url,
                attachmentKind: kind,
                fileName,
            });
            setInput('');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Could not upload file');
        } finally {
            setUploading(false);
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                onChange={handleFileChange}
            />
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center h-full">
                        <p className="text-white/30 text-xs text-center">
                            No messages yet. Send text or attach a photo or document.
                        </p>
                    </div>
                )}
                {messages.map((msg) => {
                    const isOwn = msg.senderId === currentUserId;
                    const hasImage = msg.attachmentKind === 'image' && msg.attachmentUrl;
                    const hasFile = msg.attachmentKind === 'file' && msg.attachmentUrl;
                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                        >
                            {!isOwn && (
                                <span className="text-[10px] text-white/40 mb-0.5 px-1">
                                    {msg.senderName || 'Participant'}
                                </span>
                            )}
                            <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs break-words ${isOwn
                                    ? 'bg-sky-500/35 text-white'
                                    : 'bg-white/8 text-white/90'
                                    }`}
                            >
                                {hasImage ? (
                                    <a href={msg.attachmentUrl!} target="_blank" rel="noopener noreferrer" className="block -mx-1 -mt-1">
                                        <img
                                            src={msg.attachmentUrl!}
                                            alt={msg.fileName || 'Shared image'}
                                            className="rounded-lg max-h-52 w-full object-contain bg-black/20"
                                        />
                                    </a>
                                ) : null}
                                {hasFile ? (
                                    <a
                                        href={msg.attachmentUrl!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 ${hasImage ? 'mt-2' : ''} p-2 rounded-lg bg-black/25 text-indigo-200 hover:bg-black/35`}
                                    >
                                        <FileText className="w-4 h-4 shrink-0" />
                                        <span className="truncate text-[11px] font-medium">{msg.fileName || 'File'}</span>
                                    </a>
                                ) : null}
                                {msg.message ? (
                                    <p className={`whitespace-pre-wrap break-words ${hasImage || hasFile ? 'mt-2' : ''}`}>{msg.message}</p>
                                ) : null}
                                {!msg.message && !hasImage && !hasFile ? (
                                    <p className="text-white/50">(empty)</p>
                                ) : null}
                            </div>
                            <span className="text-[10px] text-white/30 mt-0.5 px-1">
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        title="Attach photo or document"
                        className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors disabled:opacity-40 shrink-0"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message or caption for attachment…"
                        className="flex-1 bg-white/5 border border-white/10 rounded-full px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400/50 min-w-0"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="p-2 rounded-full bg-sky-400 text-slate-900 hover:bg-sky-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}


type RtcStatLike = {
    id: string;
    type: string;
    kind?: string;
    bytesReceived?: number;
    state?: string;
    nominated?: boolean;
    localCandidateId?: string;
    candidateType?: string;
};

function formatDataSize(bytes: number) {
    if (bytes <= 0) return '0';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type PeerDiagnosticRow = {
    peerId: string;
    name: string;
    connectionState: string;
    route: string;
    audioBytes: number;
    videoBytes: number;
};

/** Shows whether each peer link is up and whether media bytes are actually arriving. */
function ConnectionHealth({ peers, relayAvailable }: { peers: Map<string, PeerState>; relayAvailable: boolean | null }) {
    const [rows, setRows] = useState<PeerDiagnosticRow[]>([]);

    useEffect(() => {
        let cancelled = false;

        const read = async () => {
            const next: PeerDiagnosticRow[] = [];
            for (const [peerId, peer] of peers.entries()) {
                let audioBytes = 0;
                let videoBytes = 0;
                let route = '';
                try {
                    const report = await peer.connection.getStats();
                    const candidates = new Map<string, RtcStatLike>();
                    report.forEach((raw) => {
                        const stat = raw as unknown as RtcStatLike;
                        if (stat.type === 'local-candidate') candidates.set(stat.id, stat);
                    });
                    report.forEach((raw) => {
                        const stat = raw as unknown as RtcStatLike;
                        if (stat.type === 'inbound-rtp' && stat.kind === 'audio') audioBytes = stat.bytesReceived ?? 0;
                        if (stat.type === 'inbound-rtp' && stat.kind === 'video') videoBytes = stat.bytesReceived ?? 0;
                        if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
                            route = candidates.get(stat.localCandidateId ?? '')?.candidateType ?? '';
                        }
                    });
                } catch {
                    /* stats unavailable */
                }
                next.push({
                    peerId,
                    name: String(peer.userName ?? '').trim() || 'Participant',
                    connectionState: peer.connection.connectionState,
                    route,
                    audioBytes,
                    videoBytes,
                });
            }
            if (!cancelled) setRows(next);
        };

        void read();
        const timer = setInterval(() => void read(), 2000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [peers]);

    return (
        <div className="shrink-0 border-b border-white/5 px-3 py-2 space-y-1">
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Connection</p>
            {relayAvailable === false ? (
                <p className="text-amber-300/80 text-[10px] leading-snug">
                    No relay server configured. Calls work on the same Wi-Fi, but usually fail between mobile networks.
                </p>
            ) : null}
            {rows.length === 0 ? (
                <p className="text-amber-300/80 text-[10px] leading-snug">
                    No media connection yet. If someone is listed below, their audio and video cannot reach you.
                </p>
            ) : (
                rows.map((row) => {
                    const linked = row.connectionState === 'connected';
                    return (
                        <div key={row.peerId} className="text-[10px] leading-snug">
                            <span className="text-white/70">{row.name}</span>
                            <span className={linked ? 'text-emerald-300/90' : 'text-amber-300/90'}> · {row.connectionState}</span>
                            {row.route ? <span className="text-white/35"> · {row.route}</span> : null}
                            <span className={row.audioBytes > 0 ? 'text-white/45' : 'text-amber-300/90'}>
                                {' '}· audio {formatDataSize(row.audioBytes)}
                            </span>
                            <span className={row.videoBytes > 0 ? 'text-white/45' : 'text-white/35'}>
                                {' '}· video {formatDataSize(row.videoBytes)}
                            </span>
                        </div>
                    );
                })
            )}
        </div>
    );
}

// Participants panel showing connected users from Realtime presence
function ParticipantsPanel({
    participants,
    peers,
    relayAvailable = null,
    currentUserId,
    currentPeerId = '',
    canModerateMeetingRoom = false,
    meetingCreatorId = null,
    selfUnmuteLocked = false,
    selfLiveTotalFromDb = 0,
    sessionSegmentStartMs = Date.now(),
    onAllowUnmutePeer,
    onKickPeer,
}: {
    participants: RoomParticipant[];
    peers: Map<string, PeerState>;
    relayAvailable?: boolean | null;
    currentUserId: string;
    currentPeerId?: string;
    canModerateMeetingRoom?: boolean;
    meetingCreatorId?: string | null;
    selfUnmuteLocked?: boolean;
    selfLiveTotalFromDb?: number;
    sessionSegmentStartMs?: number;
    onAllowUnmutePeer?: (userId: string) => void;
    onKickPeer?: (userId: string) => void;
}) {
    const isSelf = (p: RoomParticipant) => (currentPeerId ? p.peerId === currentPeerId : p.userId === currentUserId);
    const sorted = [...participants].sort((a, b) => {
        if (isSelf(a)) return -1;
        if (isSelf(b)) return 1;
        const an = String(a.userName ?? '').trim() || 'Participant';
        const bn = String(b.userName ?? '').trim() || 'Participant';
        return an.localeCompare(bn);
    });

    const now = Date.now();

    return (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <ConnectionHealth peers={peers} relayAvailable={relayAvailable} />
            {canModerateMeetingRoom ? (
                <p className="text-white/35 text-[10px] px-3 pt-2 pb-1 leading-snug shrink-0 border-b border-white/5">
                    Mic: allow this person to unmute. Kick: remove from room (not shown for the meeting creator).
                </p>
            ) : null}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {sorted.length === 0 && (
                    <div className="flex-1 flex items-center justify-center h-full min-h-[120px]">
                        <p className="text-white/30 text-xs text-center">
                            No participants connected yet
                        </p>
                    </div>
                )}
                {sorted.map((p) => {
                    const isYou = isSelf(p);
                    const peerIsMeetingCreator = Boolean(meetingCreatorId && p.userId === meetingCreatorId);
                    const displayName = String(p.userName ?? '').trim() || 'Participant';
                    const initials = initialsFromDisplayName(displayName).slice(0, 2) || '?';

                    let dwellSec = 0;
                    if (isYou) {
                        dwellSec = selfLiveTotalFromDb + Math.max(0, (now - sessionSegmentStartMs) / 1000);
                    } else {
                        const t = Date.parse(p.joinedAt);
                        dwellSec = Number.isNaN(t) ? 0 : Math.max(0, (now - t) / 1000);
                    }

                    return (
                        <div
                            key={p.peerId}
                            className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.userRole === 'Guest' ? 'bg-gradient-to-br from-gray-500 to-gray-600' :
                                p.userRole === 'Executive' ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                                    p.userRole === 'Faculty' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                                        p.userRole === 'Head' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                                            p.userRole === 'Co-Head' ? 'bg-gradient-to-br from-cyan-500 to-sky-600' :
                                                p.userRole === 'Admin' ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                                                    p.userRole ? 'bg-gradient-to-br from-amber-400 to-yellow-500' :
                                                        'bg-gradient-to-br from-indigo-500 to-purple-600'
                                }`}>
                                <span className="text-white text-[10px] font-bold">{initials}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-white text-xs font-medium truncate">
                                        {displayName}
                                        {isYou && <span className="ml-1 text-[10px] text-indigo-400 font-normal">(You)</span>}
                                    </p>
                                    {p.userRole && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${p.userRole === 'Guest' ? 'bg-gray-500/30 text-gray-300' :
                                            p.userRole === 'Executive' ? 'bg-yellow-500/30 text-yellow-300' :
                                                p.userRole === 'Faculty' ? 'bg-amber-500/30 text-amber-300' :
                                                    p.userRole === 'Head' ? 'bg-blue-500/30 text-blue-200' :
                                                        p.userRole === 'Co-Head' ? 'bg-cyan-500/30 text-cyan-200' :
                                                            p.userRole === 'Admin' ? 'bg-red-500/30 text-red-300' :
                                                                'bg-yellow-500/30 text-yellow-300'
                                            }`}>
                                            {p.userRole === 'Guest' ? '👤 Guest' :
                                                p.userRole === 'Executive' ? '👑 Executive' :
                                                    p.userRole === 'Faculty' ? '🎓 Faculty' :
                                                        p.userRole === 'Head' ? '🧭 Head' :
                                                            p.userRole === 'Co-Head' ? '📍 Co-Head' :
                                                                p.userRole === 'Admin' ? '🛡️ Admin' :
                                                                    `👑 ${p.userRole}`}
                                        </span>
                                    )}
                                </div>
                                <p className="text-white/40 text-[10px] mt-0.5 tabular-nums">
                                    In room this visit: {formatDurationSeconds(dwellSec)}
                                    {isYou && selfUnmuteLocked ? (
                                        <span className="text-amber-200/80 ml-1">· mic locked</span>
                                    ) : null}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {canModerateMeetingRoom && !isYou ? (
                                    <>
                                        <button
                                            type="button"
                                            title="Allow this person to unmute"
                                            onClick={() => onAllowUnmutePeer?.(p.userId)}
                                            className="p-1.5 rounded-lg bg-white/10 text-emerald-200 hover:bg-white/15"
                                        >
                                            <Mic className="w-3.5 h-3.5" />
                                        </button>
                                        {!peerIsMeetingCreator ? (
                                            <button
                                                type="button"
                                                title="Kick — remove from meeting"
                                                onClick={() => onKickPeer?.(p.userId)}
                                                className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                            >
                                                <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                        ) : null}
                                    </>
                                ) : null}
                                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MeetingDetailsPanel({
    meeting,
    participants,
    currentUserId,
    localStream,
    currentUserName,
    isMuted,
    expanded = false,
}: {
    meeting: Meeting;
    participants: RoomParticipant[];
    currentUserId: string;
    localStream: MediaStream | null;
    currentUserName: string;
    isMuted: boolean;
    expanded?: boolean;
}) {
    const when = new Date(meeting.meeting_date ?? '');
    const scheduleOk = !Number.isNaN(when.getTime());
    return (
        <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${expanded ? 'max-w-4xl mx-auto w-full' : ''}`}>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-white/50 text-[11px] mb-1">Meeting Title</p>
                <p className="text-white text-sm font-semibold">{meeting.title ?? 'Meeting'}</p>
                {meeting.description && <p className="text-white/70 text-xs mt-2 leading-relaxed">{meeting.description}</p>}
            </div>
            <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                    <DynamicLogo width={20} height={20} />
                    <p className="text-sky-100 text-xs font-semibold">IIChE AVVU SC</p>
                </div>
                <p className="text-white/80 text-xs">Fueled by Passion, Driven by Students</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-white/50 text-[11px] mb-2">Schedule</p>
                {scheduleOk ? (
                    <>
                        <p className="text-white/90 text-xs">{formatPortalDate(when)}</p>
                        <p className="text-white/70 text-xs mt-1">{when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </>
                ) : (
                    <p className="text-white/50 text-xs">Time not available</p>
                )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-white/50 text-[11px] mb-1">Your microphone</p>
                <p className="text-white/35 text-[10px] mb-3">Only your mic level is shown here, not other participants.</p>
                <div className="flex justify-center max-w-[200px] mx-auto">
                    <ParticipantMicSphere name={currentUserName || 'You'} stream={localStream} muted={isMuted} isYou />
                </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-white/50 text-[11px]">Participants</p>
                    <p className="text-white/70 text-[11px]">{participants.length} connected</p>
                </div>
                <ParticipantCardsGrid participants={participants} currentUserId={currentUserId} />
            </div>
        </div>
    );
}

function ParticipantMicSphere({
    name,
    stream,
    muted,
    isYou = false,
    compact = false,
}: {
    name: string;
    stream: MediaStream | null;
    muted: boolean;
    isYou?: boolean;
    compact?: boolean;
}) {
    const [level, setLevel] = useState(0);
    useEffect(() => {
        if (!stream || muted) {
            setLevel(0);
            return;
        }
        const audioTrack = stream.getAudioTracks?.()[0];
        if (!audioTrack || !audioTrack.enabled) {
            setLevel(0);
            return;
        }
        let ctx: AudioContext | null = null;
        let src: MediaStreamAudioSourceNode | null = null;
        let analyser: AnalyserNode | null = null;
        let probe: MediaStreamTrack | null = null;
        let raf = 0;
        try {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return;
            ctx = new Ctx();
            analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            probe = audioTrack.clone();
            src = ctx.createMediaStreamSource(new MediaStream([probe]));
            src.connect(analyser);
            const arr = new Uint8Array(analyser.frequencyBinCount);
            const loop = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(arr);
                const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
                setLevel(Math.min(100, Math.round((avg / 255) * 180)));
                raf = requestAnimationFrame(loop);
            };
            loop();
        } catch (e) {
            console.warn('ParticipantMicSphere analyser unavailable', e);
            setLevel(0);
        }
        return () => {
            cancelAnimationFrame(raf);
            try {
                src?.disconnect();
                analyser?.disconnect();
                probe?.stop();
            } catch {
                /* ignore */
            }
            void ctx?.close();
        };
    }, [stream, muted]);

    const intensity = Math.max(0, Math.min(1, level / 100));
    const stateLabel = muted ? 'Muted' : intensity > 0.66 ? 'Loud' : intensity > 0.3 ? 'Speaking' : 'Quiet';
    return (
        <div className={`rounded-xl border border-white/10 bg-white/5 ${compact ? 'p-2 flex items-center gap-2 text-left' : 'p-3 text-center'}`}>
            <div className={`relative ${compact ? 'w-10 h-10' : 'w-16 h-16'} ${compact ? '' : 'mx-auto'}`}>
                <span
                    className="absolute inset-0 rounded-full border border-cyan-300/40"
                    style={{ transform: `scale(${1 + intensity * 0.55})`, opacity: muted ? 0.25 : 0.55 }}
                />
                <span
                    className="absolute inset-0 rounded-full border border-violet-300/35"
                    style={{ transform: `scale(${1 + intensity * 0.85})`, opacity: muted ? 0.15 : 0.45 }}
                />
                <span className={`absolute ${compact ? 'inset-1.5' : 'inset-2'} rounded-full bg-gradient-to-br from-cyan-300 via-blue-400 to-violet-500 shadow-[0_0_22px_rgba(99,102,241,0.45)]`} />
            </div>
            <div className={compact ? 'min-w-0 flex-1' : ''}>
                <p className={`text-[11px] text-white truncate ${compact ? '' : 'mt-2'}`}>{name}{isYou ? ' (You)' : ''}</p>
                <p className="text-[10px] text-white/60">{stateLabel}</p>
            </div>
        </div>
    );
}

function ParticipantCardsGrid({
    participants,
    currentUserId,
}: {
    participants: RoomParticipant[];
    currentUserId: string;
}) {
    const sorted = [...participants].sort((a, b) => {
        if (a.userId === currentUserId) return -1;
        if (b.userId === currentUserId) return 1;
        const an = String(a.userName ?? '').trim() || 'Participant';
        const bn = String(b.userName ?? '').trim() || 'Participant';
        return an.localeCompare(bn);
    });
    if (sorted.length === 0) return <p className="text-white/30 text-xs">No participants connected yet.</p>;
    return (
        <div className="grid grid-cols-1 gap-2">
            {sorted.map((p) => {
                const label = String(p.userName ?? '').trim() || 'Participant';
                const initials = initialsFromDisplayName(label).slice(0, 2) || '?';
                const isYou = p.userId === currentUserId;
                return (
                    <div key={p.peerId} className="rounded-lg border border-white/10 bg-white/5 p-2.5 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><span className="text-white text-[10px] font-bold">{initials}</span></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-white text-xs truncate">{label}{isYou && <span className="ml-1 text-indigo-300">(You)</span>}</p>
                            {p.userRole && <p className="text-[10px] text-white/50 truncate">{p.userRole}</p>}
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                );
            })}
        </div>
    );
}

function ApprovalsPanel({
    pendingRequests,
    processingApprovalKey,
    onApprove,
    onReject,
}: {
    pendingRequests: PendingJoinRequest[];
    processingApprovalKey: string | null;
    onApprove: (req: PendingJoinRequest) => Promise<void>;
    onReject: (req: PendingJoinRequest) => Promise<void>;
}) {
    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 p-3">
                <p className="text-sky-100 text-xs font-semibold">Join requests</p>
                <p className="text-white/70 text-[11px] mt-1">Approve signed-in members or guests (match guest ID + name).</p>
            </div>
            {pendingRequests.length === 0 ? (
                <p className="text-white/40 text-xs px-1 py-4 text-center">No pending requests.</p>
            ) : (
                pendingRequests.map((req) => {
                    const busy = processingApprovalKey === req.key;
                    if (req.requestKind === 'guest') {
                        return (
                            <div key={req.key} className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 p-3">
                                <p className="text-[10px] uppercase tracking-wide text-indigo-200/80 mb-1">Guest</p>
                                <p className="text-white text-xs font-semibold truncate">{req.display_name}</p>
                                <p className="text-white/45 text-[10px] mt-1 font-mono break-all">{req.guest_id}</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { void onApprove(req); }}
                                        disabled={busy}
                                        className="flex-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { void onReject(req); }}
                                        disabled={busy}
                                        className="flex-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        <X className="w-3.5 h-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        );
                    }
                    const name = req.profiles?.name || 'Member';
                    const email = req.profiles?.email || '';
                    return (
                        <div key={req.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Member</p>
                            <p className="text-white text-xs font-semibold truncate">{name}</p>
                            {email ? <p className="text-white/50 text-[11px] truncate">{email}</p> : null}
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { void onApprove(req); }}
                                    disabled={busy}
                                    className="flex-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void onReject(req); }}
                                    disabled={busy}
                                    className="flex-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    <X className="w-3.5 h-3.5" /> Reject
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
