'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    PanelLeftClose,
    PanelLeftOpen,
    Copy,
    Paperclip,
    FileText,
    UserMinus,
} from 'lucide-react';
import { useWebRTC, type PeerState } from '@/hooks/useWebRTC';
import type { ChatMessage, RoomControlPayload, RoomParticipant, SendChatPayload } from '@/hooks/useWebRTC';
import DynamicLogo from '@/components/DynamicLogo';
import {
    applyAudioOutputToElement,
    applyMeetingAudioSession,
    playSpeakerTestTone,
    resolvePreferredAudioOutput,
    unlockRemoteMediaElements,
} from '@/lib/meeting-audio-output';

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

async function acquireMeetingMedia(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
    const attempts: MediaStreamConstraints[] = [
        {
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { facingMode: 'user' },
        },
        { audio: true, video: true },
        { audio: true, video: false },
        { audio: false, video: true },
    ];
    for (const constraints of attempts) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            applyMeetingAudioSession(true);
            return markMeetingTracks(stream);
        } catch {
            /* try a simpler constraint set */
        }
    }
    return null;
}

/** Browsers block remote audio until a user gesture; Join Meeting calls this. */
async function unlockMeetingAudioPlayback() {
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
            const ctx = new Ctx();
            if (ctx.state === 'suspended') await ctx.resume();
            void ctx.close();
        }
    } catch {
        /* ignore */
    }
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
                    <VideoOff className={`${cornerIcon} text-amber-200`} />
                </div>
            ) : null}
        </div>
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
    const [showBrandRail, setShowBrandRail] = useState(false);
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
        if (!stream) return null;
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

    const meetMediaRef = useRef({ isScreenSharing: false, localStream: null as MediaStream | null });
    meetMediaRef.current = { isScreenSharing, localStream };

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
    } = useWebRTC({
        supabase,
        roomId,
        userId: currentUserId,
        userName: currentUserName,
        userRole: currentUserRole,
        localStream,
        enabled: !!meeting && !!currentUserId && !!currentUserName && hasJoinedMeeting && !removedByModerator,
        getCameraSendingSnapshot: () => {
            const { isScreenSharing: sharing, localStream: stream } = meetMediaRef.current;
            if (sharing) return true;
            const vt = stream?.getVideoTracks()[0];
            return Boolean(vt && vt.readyState === 'live' && vt.enabled);
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
                                    if (!cancelled && stream) setLocalStream(stream);
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
                if (!cancelled && stream) setLocalStream(stream);

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
        if (preJoinVideoRef.current && localStream) {
            preJoinVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (!isScreenSharing) {
            setLocalPreviewStream(localStream);
        }
    }, [localStream, isScreenSharing]);

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
        () => participants.filter((p) => p.userId !== currentUserId).length,
        [participants, currentUserId],
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
                if (!cancelled && stream) setLocalStream(stream);
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
                if (!cancelled && stream) setLocalStream(stream);
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
                    toast.error('Could not access microphone. Check browser microphone permissions.');
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
            let camOnly: MediaStream;
            try {
                camOnly = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                });
            } catch {
                camOnly = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            const freshTrack = camOnly.getVideoTracks()[0];
            if (!freshTrack) return null;
            freshTrack.enabled = true;
            markMeetingTracks(new MediaStream([freshTrack]));

            const oldTrack = stream.getVideoTracks()[0];
            if (oldTrack) {
                stream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            stream.addTrack(freshTrack);

            await replaceVideoTrack(freshTrack);
            const next = new MediaStream(stream.getTracks());
            setLocalStream(next);
            setLocalPreviewStream(next);
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
        const vt = localStream?.getVideoTracks()[0];
        sendCameraState(Boolean(vt && vt.readyState === 'live' && vt.enabled && !isCameraOff));
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

            if (isCameraOff) {
                try {
                    await reacquireAndBindCameraTrack(stream);
                    setIsCameraOff(false);
                    sendCameraState(true);
                } catch {
                    toast.error('Could not turn on camera. Check browser camera permissions.');
                }
                return;
            }

            const currentTrack = stream.getVideoTracks()[0];
            if (currentTrack) {
                currentTrack.enabled = false;
                stream.removeTrack(currentTrack);
                currentTrack.stop();
            }
            await replaceVideoTrack(null);
            const next = new MediaStream(stream.getTracks());
            setLocalStream(next);
            setLocalPreviewStream(next);
            setLocalVideoRenderKey((k) => k + 1);
            setIsCameraOff(true);
            sendCameraState(false);
        };
        void run();
    }, [ensureLocalMedia, isCameraOff, reacquireAndBindCameraTrack, replaceVideoTrack, sendCameraState]);

    const toggleScreenShare = useCallback(async () => {
        const activeStream = localStream || await ensureLocalMedia();
        if (!activeStream) return;

        if (!isScreenSharing) {
            if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
                toast.error(
                    'Screen sharing is not available in this browser. Try Chrome or Edge on a desktop; many mobile browsers do not support it yet.',
                );
                return;
            }
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                // Save the original camera track so we can restore it later
                const originalCameraTrack = activeStream.getVideoTracks()[0];
                cameraTrackRef.current = originalCameraTrack;
                screenTrackRef.current = screenTrack;

                // Replace the video track in all peer connections
                await replaceVideoTrack(screenTrack);

                setLocalPreviewStream(new MediaStream([screenTrack]));

                // Auto-revert when user stops sharing via browser UI
                screenTrack.onended = async () => {
                    const camTrack = cameraTrackRef.current;
                    if (camTrack) {
                        await replaceVideoTrack(camTrack);
                        setLocalPreviewStream(activeStream);
                        setLocalVideoRenderKey((k) => k + 1);
                        cameraTrackRef.current = null;
                    }
                    screenTrackRef.current = null;
                    setIsScreenSharing(false);
                    sendCameraState(Boolean(camTrack?.enabled));
                };

                setIsScreenSharing(true);
                sendCameraState(true);
            } catch {
                // User cancelled the screen share picker
                console.warn('Screen sharing cancelled or failed');
            }
        } else {
            // Stop screen sharing — restore camera track
            const screenTrack = screenTrackRef.current;
            const camTrack = cameraTrackRef.current;

            if (camTrack) {
                await replaceVideoTrack(camTrack);
                setLocalPreviewStream(activeStream);
                setLocalVideoRenderKey((k) => k + 1);
                cameraTrackRef.current = null;
            }
            screenTrack?.stop();
            screenTrackRef.current = null;
            setIsScreenSharing(false);
            sendCameraState(Boolean(camTrack?.enabled));
        }
    }, [localStream, ensureLocalMedia, isScreenSharing, replaceVideoTrack, sendCameraState]);

    const leaveMeeting = useCallback(() => {
        localStream?.getTracks().forEach((track) => track.stop());
        cameraTrackRef.current?.stop();
        cameraTrackRef.current = null;
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    <p className="text-white/70 text-sm">Joining meeting room...</p>
                </motion.div>
            </div>
        );
    }

    // Access denied state
    // Pending approval state
    if (pendingApproval) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-dark rounded-2xl p-8 max-w-md text-center"
                >
                    <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
                    <h2 className="text-xl font-bold text-white mb-2">Waiting for Approval</h2>
                    <p className="text-white/60 text-sm mb-4">
                        {meeting?.title}
                    </p>
                    <p className="text-white/40 text-xs mb-6">
                        This meeting requires approval before you can join. The organizer, EC, or faculty will approve your request.
                    </p>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                        <span className="text-[11px] text-amber-100">{approvalStatusMessage}</span>
                    </div>
                    <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-yellow-500/10 p-4 mb-6 text-left">
                        <div className="flex items-center gap-2 mb-2">
                            <DynamicLogo width={20} height={20} />
                            <p className="text-amber-200 text-xs font-semibold">IIChE AVVU SC</p>
                        </div>
                        <p className="text-white/80 text-xs leading-relaxed">
                            Your join request is submitted. Please wait for organizer/EC/faculty approval.
                        </p>
                        <p className="text-amber-100/80 text-[11px] mt-2">Fueled by Passion, Driven by Students</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/meetings')}
                        className="btn-gradient-purple px-6 py-2.5 rounded-xl text-sm font-semibold"
                    >
                        Back to Meetings
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    if (guestWaitingForApproval && meeting) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-dark rounded-2xl p-8 max-w-md w-full text-center"
                >
                    <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
                    <h2 className="text-xl font-bold text-white mb-2">Waiting for approval</h2>
                    <p className="text-white/60 text-sm mb-4">{meeting.title ?? 'Meeting'}</p>
                    <p className="text-white/45 text-xs mb-4">
                        You joined as <span className="text-white/80 font-medium">{currentUserName}</span>. The organizer will use your <strong className="text-amber-200/90">guest ID</strong> to approve you.
                    </p>
                    <div className="rounded-xl border border-amber-400/35 bg-black/30 p-3 mb-4 text-left">
                        <p className="text-[10px] uppercase tracking-wide text-amber-200/70 mb-1">Your guest ID</p>
                        <div className="flex items-center gap-2">
                            <code className="text-amber-100 text-xs break-all flex-1 font-mono">{currentUserId}</code>
                            <button
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard.writeText(currentUserId);
                                    toast.success('Guest ID copied');
                                }}
                                className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80"
                                title="Copy guest ID"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <p className="text-white/35 text-[11px] mb-6">Keep this page open. You can refresh; your browser remembers this ID for this room.</p>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            sessionStorage.removeItem(guestSessionStorageKey(roomId));
                            setGuestWaitingForApproval(false);
                            setShowGuestEntry(true);
                            setCurrentUserId('');
                            setCurrentUserName('');
                        }}
                        className="text-white/50 hover:text-white/70 text-xs underline underline-offset-2"
                    >
                        Cancel and go back
                    </motion.button>
                </motion.div>
            </div>
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
            if (stream) setLocalStream(stream);
            setLoading(false);
        };

        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-dark rounded-2xl p-8 max-w-md w-full text-center">
                    <UserCircle className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Join as Guest</h2>
                    <p className="text-white/60 text-sm mb-3">{meeting?.title}</p>
                    {guestRejectedReason ? (
                        <p className="text-rose-300/90 text-xs mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2">{guestRejectedReason}</p>
                    ) : null}
                    <p className="text-white/45 text-xs mb-4 leading-relaxed">
                        Signing in is optional. Enter the name you want others to see.
                        {meeting?.access_type === 'general' ? (
                            <span className="block mt-2 text-amber-200/70">
                                An organizer will approve your request before you enter. You will get a <strong className="text-amber-100">guest ID</strong> to share if needed; watch this page for approval.
                            </span>
                        ) : null}
                    </p>
                    <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && joinAsGuest()}
                        placeholder="Enter your name" autoFocus
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 outline-none focus:border-indigo-500 mb-4 text-center" />
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={joinAsGuest} disabled={!guestName.trim()}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-40">
                        Join Meeting
                    </motion.button>
                    <p className="text-white/35 text-[11px] mt-4">
                        <Link href={`/login?next=${encodeURIComponent(`/meet/${roomId}`)}`} className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">
                            Sign in with your account
                        </Link>
                        {' '}— optional, for portal members
                    </p>
                </motion.div>
            </div>
        );
    }

    if (accessDenied || !meeting) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-dark rounded-2xl p-8 max-w-md text-center"
                >
                    <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-white/60 text-sm mb-6">
                        You don&apos;t have permission to join this meeting. Only invited
                        participants and the meeting creator can access this room.
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/meetings')}
                        className="btn-gradient-purple px-6 py-2.5 rounded-xl text-sm font-semibold"
                    >
                        Back to Meetings
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    if (!hasJoinedMeeting) {
        return (
            <div className="min-h-screen bg-[#070707] flex items-center justify-center px-4">
                <div className="w-full max-w-4xl rounded-2xl border border-amber-300/25 bg-gradient-to-br from-black/90 via-zinc-950/95 to-black/90 p-4 sm:p-6 shadow-[0_0_0_1px_rgba(250,204,21,0.08),0_16px_40px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <p className="text-amber-200/80 text-xs uppercase tracking-wide">Preview before joining</p>
                            <h2 className="text-amber-100 text-lg sm:text-xl font-bold">{meeting.title ?? 'Meeting'}</h2>
                        </div>
                        <button onClick={() => router.push('/dashboard/meetings')} className="text-amber-100/90 hover:text-amber-200 text-xs border border-amber-300/30 rounded-lg px-3 py-1.5">Back</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
                        <div className="relative rounded-xl overflow-hidden bg-black/40 border border-amber-200/20 aspect-video">
                            {localStream && !isCameraOff ? (
                                <video ref={preJoinVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900/90 to-black/90">
                                    <CameraOffAvatar
                                        name={currentUserName || 'You'}
                                        profileImageUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                        isGuest={currentUserId.startsWith('guest-')}
                                        showCameraOffBadge={false}
                                    />
                                    {currentUserId ? (
                                        <RemoteVideoRoleBadge peerId={currentUserId} userRole={currentUserRole} />
                                    ) : null}
                                    <p className="text-white/50 text-sm">{isCameraOff ? 'Camera off' : 'No camera preview'}</p>
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-amber-200/20 bg-gradient-to-b from-zinc-900/70 to-black/60 p-4 space-y-4">
                            <div>
                                <p className="text-amber-100/90 text-xs mb-2">Microphone Level</p>
                                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                                    <div className={`${micLevel > 70 ? 'bg-amber-300' : micLevel > 35 ? 'bg-yellow-400' : 'bg-slate-300'} h-full`} style={{ width: `${isMuted ? 0 : micLevel}%` }} />
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-50/70"><Volume2 className="w-3.5 h-3.5" /><span>{isMuted ? 'Muted' : `${micLevel}% input`}</span></div>
                                <p className="mt-2 text-[10px] text-amber-50/45 leading-snug">That bar is your microphone. Tap Test speaker to check you can hear this phone’s loudspeaker.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={toggleMute} className="px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-slate-300/30 text-slate-100 text-xs">{isMuted ? 'Unmute Mic' : 'Mute Mic'}</button>
                                <button onClick={toggleCamera} className="px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-slate-300/30 text-slate-100 text-xs">{isCameraOff ? 'Start Camera' : 'Stop Camera'}</button>
                                <button
                                    onClick={() => {
                                        void (async () => {
                                            setSpeakerOn(true);
                                            await applySpeakerOutput(true, { playChime: true });
                                        })();
                                    }}
                                    className="px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-slate-300/30 text-slate-100 text-xs"
                                >
                                    Test speaker
                                </button>
                                {!localStream && (
                                    <button onClick={ensureLocalMedia} className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-300/35 text-xs">
                                        Enable Camera & Mic
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    void (async () => {
                                        await unlockMeetingAudioPlayback();
                                        const stream = await ensureLocalMedia();
                                        if (!stream) {
                                            toast.error('Allow camera and microphone so others can see and hear you.');
                                        }
                                        setSpeakerOn(true);
                                        await applySpeakerOutput(true);
                                        setHasJoinedMeeting(true);
                                    })();
                                }}
                                className="w-full btn-gradient-amber px-4 py-2.5 rounded-xl text-sm font-semibold"
                            >
                                Join Meeting
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const screenShareApiAvailable =
        typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';

    // Control bar buttons config (screen share always listed; unsupported browsers get a toast on tap)
    const controls = [
        {
            icon: isMuted ? MicOff : Mic,
            label: isMuted ? 'Unmute' : 'Mute',
            onClick: toggleMute,
            active: !isMuted,
            danger: isMuted,
        },
        {
            icon: isCameraOff ? VideoOff : Video,
            label: isCameraOff ? 'Start Camera' : 'Stop Camera',
            onClick: toggleCamera,
            active: !isCameraOff,
            danger: isCameraOff,
        },
        {
            icon: speakerOn ? Speaker : Volume2,
            label: speakerOn ? 'Speaker' : 'Earpiece',
            onClick: toggleSpeaker,
            active: speakerOn,
        },
        {
            icon: MonitorUp,
            label: isScreenSharing ? 'Stop Sharing' : 'Share Screen',
            onClick: toggleScreenShare,
            active: isScreenSharing,
            dimmed: !screenShareApiAvailable && !isScreenSharing,
        },
        {
            icon: MessageSquare,
            label: 'Chat',
            onClick: () => { setIsChatOpen((prev: boolean) => !prev); setIsApprovalsOpen(false); },
            active: isChatOpen,
        },
        {
            icon: Users,
            label: 'Participants',
            onClick: () => { setIsParticipantListOpen((prev: boolean) => !prev); setIsChatOpen(false); setIsApprovalsOpen(false); },
            active: isParticipantListOpen,
        },
        ...(canApproveRequests ? [{
            icon: Check,
            label: 'Approvals',
            onClick: () => { setIsApprovalsOpen((prev: boolean) => !prev); setIsChatOpen(false); setIsParticipantListOpen(false); },
            active: isApprovalsOpen,
        }] : []),
        ...(canModerateMeetingRoom ? [
            {
                icon: MicOff,
                label: 'Mute All',
                onClick: () => {
                    const policy = meeting?.created_by === currentUserId ? 'creator' : 'ec_faculty';
                    sendRoomControl('mute-all', undefined, { mutePolicy: policy });
                    toast.success(
                        policy === 'creator'
                            ? 'Sent: mute (EC & faculty exempt)'
                            : 'Sent: mute (meeting creator exempt)',
                    );
                },
                active: false,
                danger: true,
            },
            {
                icon: Volume2,
                label: 'Unmute All',
                onClick: () => {
                    sendRoomControl('allow-unmute');
                    toast.success('Sent: everyone can unmute');
                },
                active: false,
            },
        ] : []),
    ];

    return (
        <div
            className="min-h-[100dvh] bg-[#050505] flex flex-col overflow-hidden relative"
            onPointerDown={() => { void unlockMeetingAudioPlayback(); }}
        >
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setShowBrandRail((prev) => !prev)} className="absolute left-2 sm:left-3 top-20 sm:top-1/2 sm:-translate-y-1/2 z-30 p-2 rounded-r-xl bg-amber-300/15 text-amber-100 hover:bg-amber-300/25 backdrop-blur border border-amber-300/30" title="Show branding panel">
                {showBrandRail ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </motion.button>
            <AnimatePresence>
                {showBrandRail && (
                    <motion.aside initial={{ x: -280, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -280, opacity: 0 }} transition={{ duration: 0.2 }} className="absolute left-0 top-0 bottom-0 w-[88vw] max-w-72 z-20 border-r border-amber-300/25 bg-gradient-to-b from-black/95 via-zinc-950/95 to-black/95 p-3 sm:p-4 flex flex-col shadow-2xl">
                        <div className="flex items-center gap-3 mb-4"><DynamicLogo width={36} height={36} /><div><p className="text-amber-100 font-bold text-sm">IIChE AVVU SC</p><p className="text-amber-50/60 text-[11px]">Official Meeting Room</p></div></div>
                        <div className="rounded-xl bg-amber-400/10 border border-amber-300/30 p-3 mb-4"><p className="text-amber-100 text-sm font-semibold leading-5">Fueled by Passion,</p><p className="text-slate-200 text-sm font-semibold leading-5">Driven by Students</p></div>
                            <div className="rounded-xl border border-amber-300/25 bg-zinc-900/50 p-3 mb-4 space-y-2">
                            <p className="text-[10px] text-amber-100/70 uppercase tracking-wide mb-1">Meeting</p>
                            <p className="text-amber-50 text-sm font-semibold">{meeting.title ?? 'Meeting'}</p>
                            {meeting.description && (
                                    <p className="text-xs text-slate-200/80 leading-relaxed">{meeting.description}</p>
                            )}
                            {(meeting as any).agenda && (
                                <div className="mt-2">
                                    <p className="text-[10px] text-amber-100/70 uppercase tracking-wide">Agenda</p>
                                    <p className="text-xs text-slate-200/80 mt-1 whitespace-pre-wrap">{(meeting as any).agenda}</p>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-amber-50/70 mb-2 uppercase tracking-wide">Your mic</p>
                        <p className="text-[10px] text-amber-50/45 mb-2">Only your microphone level is shown here (not other participants).</p>
                        <div className="space-y-2 overflow-y-auto pr-1">
                            <ParticipantMicSphere name={currentUserName || 'You'} stream={localStream} muted={isMuted} isYou compact />
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
            {/* Background gradients */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
            </div>

            {/* Top bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-2.5 glass-dark border-b border-white/5 gap-2"
            >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <DynamicLogo width={28} height={28} />
                    <span className="text-white/90 font-bold text-sm hidden sm:block">IIChE AVVU SC</span>
                    <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h1 className="text-white font-semibold text-xs sm:text-sm truncate max-w-[145px] sm:max-w-xs">
                        {meeting.title ?? 'Meeting'}
                    </h1>
                    {isScreenSharing && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                            You are sharing screen
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={toggleSpeaker}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        speakerOn
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                            : 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                    }`}
                    title={speakerOn ? 'Playing on main speaker' : 'Playing on earpiece'}
                >
                    <Speaker className="w-3 h-3" />
                    {speakerOn ? 'Speaker' : 'Earpiece'}
                </button>
            </motion.div>
            {/* Main content area */}
            <div className="flex-1 flex relative z-10 overflow-hidden">
                {/* Video grid area */}
                <motion.div
                    layout
                    className="flex-1 p-2 sm:p-4 overflow-y-auto"
                >
                    <div className={`w-full h-full ${pinnedPeerId ? 'flex flex-col gap-3' : `grid gap-3 ${peers.size === 0 ? 'grid-cols-1' : peers.size <= 1 ? 'grid-cols-1 md:grid-cols-2' : peers.size <= 3 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}`}>
                        {pinnedPeerId && pinnedPeerId !== 'local' && peers.has(pinnedPeerId) && (
                            <div className="flex-1 min-h-0">
                                <RemoteVideo
                                    peer={peers.get(pinnedPeerId)!}
                                    peerId={pinnedPeerId}
                                    presenceRole={peerRawRoleByUserId.get(pinnedPeerId)}
                                    profileAvatarUrl={peerAvatarUrls[pinnedPeerId] ?? null}
                                    peerSignalsCameraOff={peerCameraSendingVideo[pinnedPeerId] === false}
                                    outputDeviceId={speakerOutputId}
                                    isPinned={true}
                                    onPin={() => setPinnedPeerId(null)}
                                />
                            </div>
                        )}
                        {pinnedPeerId === 'local' && (
                            <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5">
                                <LocalVideoTile
                                    key={`lv-${localVideoRenderKey}`}
                                    stream={localPreviewStream || localStream}
                                    isCameraOff={isCameraOff}
                                    isScreenSharing={isScreenSharing}
                                    displayName={currentUserName || 'You'}
                                    profileAvatarUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                    userId={currentUserId}
                                />
                                <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5 flex items-center gap-2 flex-wrap max-w-[min(100%,20rem)]">
                                    <p className="text-white text-xs font-medium">You (Pinned)</p>
                                    <RemoteVideoRoleBadge peerId={currentUserId} userRole={currentUserRole} compact />
                                </div>
                                <button onClick={() => setPinnedPeerId(null)} className="absolute top-3 right-3 bg-indigo-500/80 rounded-full p-1.5 hover:bg-indigo-500"><PinOff className="w-3 h-3 text-white" /></button>
                                {isMuted && <div className="absolute top-3 left-3 bg-red-500/80 rounded-full p-1.5"><MicOff className="w-3 h-3 text-white" /></div>}
                            </div>
                        )}
                        {pinnedPeerId && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {pinnedPeerId !== 'local' && (
                                    <div className="relative rounded-xl overflow-hidden bg-slate-900/80 border border-white/5 w-40 h-24 flex-shrink-0 cursor-pointer" onClick={() => setPinnedPeerId('local')}>
                                        <LocalVideoTile
                                            key={`lv-${localVideoRenderKey}`}
                                            stream={localPreviewStream || localStream}
                                            isCameraOff={isCameraOff}
                                            isScreenSharing={isScreenSharing}
                                            compact
                                            displayName={currentUserName || 'You'}
                                            profileAvatarUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                            userId={currentUserId}
                                        />
                                        <div className="absolute bottom-1 left-1 right-8 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1 flex-wrap min-w-0">
                                            <p className="text-white text-[10px] truncate">You</p>
                                            <RemoteVideoRoleBadge peerId={currentUserId} userRole={currentUserRole} compact />
                                        </div>
                                    </div>
                                )}
                                {Array.from(peers.entries()).filter(([pid]) => pid !== pinnedPeerId).map(([pid, peer]) => (
                                    <RemoteVideo
                                        key={pid}
                                        peer={peer}
                                        peerId={pid}
                                        presenceRole={peerRawRoleByUserId.get(pid)}
                                        profileAvatarUrl={peerAvatarUrls[pid] ?? null}
                                        peerSignalsCameraOff={peerCameraSendingVideo[pid] === false}
                                        outputDeviceId={speakerOutputId}
                                        isPinned={false}
                                        onPin={() => setPinnedPeerId(pid)}
                                        small
                                    />
                                ))}
                            </div>
                        )}
                        {!pinnedPeerId && (<>
                            <div className="relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5 aspect-video group">
                                <LocalVideoTile
                                    key={`lv-${localVideoRenderKey}`}
                                    stream={localPreviewStream || localStream}
                                    isCameraOff={isCameraOff}
                                    isScreenSharing={isScreenSharing}
                                    displayName={currentUserName || 'You'}
                                    profileAvatarUrl={localProfileAvatarUrl ?? peerAvatarUrls[currentUserId] ?? null}
                                    userId={currentUserId}
                                />
                                <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5 flex items-center gap-2 flex-wrap max-w-[min(100%,20rem)]">
                                    <p className="text-white text-xs font-medium">You</p>
                                    <RemoteVideoRoleBadge peerId={currentUserId} userRole={currentUserRole} compact />
                                </div>
                                {isMuted && <div className="absolute top-3 right-3 bg-red-500/80 rounded-full p-1.5"><MicOff className="w-3 h-3 text-white" /></div>}
                                <button onClick={() => setPinnedPeerId('local')} className="absolute top-3 left-3 bg-white/10 rounded-full p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity"><Pin className="w-3 h-3 text-white" /></button>
                            </div>
                            {Array.from(peers.entries()).map(([pid, peer]) => (
                                <RemoteVideo
                                    key={pid}
                                    peer={peer}
                                    peerId={pid}
                                    presenceRole={peerRawRoleByUserId.get(pid)}
                                    profileAvatarUrl={peerAvatarUrls[pid] ?? null}
                                    peerSignalsCameraOff={peerCameraSendingVideo[pid] === false}
                                    outputDeviceId={speakerOutputId}
                                    isPinned={false}
                                    onPin={() => setPinnedPeerId(pid)}
                                />
                            ))}
                        </>)}
                    </div>
                </motion.div>

                {/* Side panels */}
                <AnimatePresence>
                    {(isChatOpen || isParticipantListOpen || isApprovalsOpen) && (
                        <motion.div
                            initial={{ x: 360, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 360, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="absolute right-0 top-0 bottom-0 w-full sm:w-[360px] h-full border-l border-white/5 glass-dark overflow-hidden flex flex-col z-20"
                        >
                            {/* Panel tabs */}
                            <div className="flex border-b border-white/5">
                                <button
                                    onClick={() => { setIsChatOpen(true); setIsParticipantListOpen(false); }}
                                    className={`flex-1 py-3 text-xs font-semibold transition-colors ${isChatOpen
                                        ? 'text-indigo-400 border-b-2 border-indigo-400'
                                        : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    Chat
                                </button>
                                <button
                                    onClick={() => { setIsParticipantListOpen(true); setIsChatOpen(false); }}
                                    className={`flex-1 py-3 text-xs font-semibold transition-colors ${isParticipantListOpen
                                        ? 'text-indigo-400 border-b-2 border-indigo-400'
                                        : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    Participants ({participants.length})
                                </button>
                                {canApproveRequests && (
                                    <button
                                        onClick={() => { setIsApprovalsOpen(true); setIsChatOpen(false); setIsParticipantListOpen(false); }}
                                        className={`flex-1 py-3 text-xs font-semibold transition-colors ${isApprovalsOpen ? 'text-amber-300 border-b-2 border-amber-300' : 'text-white/40 hover:text-white/60'}`}
                                    >
                                        Approvals ({pendingRequests.length})
                                    </button>
                                )}
                            </div>

                            {/* Panel content */}
                            {isChatOpen ? (
                                <ChatPanel
                                    messages={chatMessages}
                                    currentUserId={currentUserId}
                                    onSend={sendChatMessage}
                                    uploadMeetingFile={uploadMeetingChatFile}
                                />
                            ) : isParticipantListOpen ? (
                                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                                    <div className="p-3 border-b border-white/5 space-y-2 shrink-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-white/50 text-[10px] uppercase tracking-wide">Room session</p>
                                            <div className="text-right">
                                                {othersPresentCount === 0 ? (
                                                    <span className="text-amber-200/90 text-[10px] font-semibold mr-2">Paused</span>
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
                                                    <p className="text-amber-200/85 text-[10px] leading-snug border border-amber-400/25 rounded-lg px-2 py-1.5 bg-amber-500/10">
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
                                                    className="w-full py-2 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-100 border border-amber-400/35 hover:bg-amber-500/30 disabled:opacity-50"
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
                                            <p className="text-amber-100/60 text-[10px]">
                                                A session duration was saved for this meeting (see meeting details).
                                            </p>
                                        ) : null}
                                    </div>
                                    <ParticipantsPanel
                                        participants={participants}
                                        currentUserId={currentUserId}
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
                                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                                    <ParticipantsPanel
                                        participants={participants}
                                        currentUserId={currentUserId}
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
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom control bar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3 px-2 sm:px-6 py-2.5 sm:py-4 glass-dark border-t border-white/5"
            >
                <div className="w-full flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 mobile-clean-scroll">
                    {controls.map((ctrl) => {
                        const dimmed = 'dimmed' in ctrl && ctrl.dimmed;
                        return (
                        <motion.button
                            key={ctrl.label}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={ctrl.onClick}
                            title={dimmed ? `${ctrl.label} (not supported on this device)` : ctrl.label}
                            className={`p-2.5 sm:p-3 rounded-xl transition-all shrink-0 ${dimmed
                                ? 'bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/50'
                                : ctrl.danger
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : ctrl.active
                                    ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                                }`}
                        >
                            <ctrl.icon className="w-5 h-5" />
                        </motion.button>
                        );
                    })}

                    <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            const link = `${window.location.origin}/meet/${roomId}`;
                            navigator.clipboard.writeText(link);
                            import('react-hot-toast').then(m => m.default.success('Meeting link copied!'));
                        }}
                        title="Copy Meeting Link"
                        className="p-2.5 sm:p-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-all shrink-0"
                    >
                        <Link2 className="w-5 h-5" />
                    </motion.button>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={leaveMeeting}
                    title="Leave Meeting"
                    className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Leave Meeting</span>
                </motion.button>
            </motion.div>
        </div>
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
            if (el && live && el.videoWidth === 0 && now - lastBlackRecovery > 4000) {
                lastBlackRecovery = now;
                el.srcObject = null;
                el.srcObject = videoOnly;
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
    const forceAvatarUi = peerSignalsCameraOff && !isRemoteScreenShare;
    const showLivePixels = hasVideo && !forceAvatarUi;
    const showConnectingUi = !forceAvatarUi && !hasVideo && !liveVideoTrack;
    const showCameraOffChrome = forceAvatarUi;

    if (small) {
        return (
            <div className="relative rounded-xl overflow-hidden bg-slate-900/80 border border-white/5 w-40 h-24 flex-shrink-0 cursor-pointer group" onClick={onPin}>
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
                    <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-b from-slate-800/95 via-slate-900 to-black/90">
                        <CameraOffAvatar name={remoteDisplayName} profileImageUrl={profileAvatarUrl} compact isGuest={isGuestPeer} />
                        <p className="text-[8px] text-white/55 uppercase tracking-wide mt-0.5">
                            {peer.connectionState === 'failed' ? 'Reconnect…' : 'Connecting…'}
                        </p>
                    </div>
                )}
                {showCameraOffChrome && (
                    <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-b from-slate-800/95 via-slate-900 to-black/90">
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
                <div className="absolute bottom-1 left-1 right-8 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1.5 flex-wrap min-w-0">
                    <p className="text-white text-[10px] truncate">{remoteDisplayName}</p>
                    {!showLivePixels ? <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} compact /> : null}
                </div>
            </div>
        );
    }

    return (
        <div className={`relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5 ${isPinned ? 'w-full h-full' : 'aspect-video'} group`}>
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
                <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 px-4 bg-gradient-to-b from-slate-800/95 via-slate-900 to-black/90">
                    <CameraOffAvatar name={remoteDisplayName} profileImageUrl={profileAvatarUrl} isGuest={isGuestPeer} />
                    <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} className="text-[10px] px-2.5 py-1" />
                    <p className="text-[10px] text-white/55 uppercase tracking-widest">
                        {peer.connectionState === 'failed' ? 'Connection failed' : 'Connecting video…'}
                    </p>
                    <p className="text-white/85 text-sm font-medium">{remoteDisplayName}</p>
                </div>
            )}
            {showCameraOffChrome && (
                <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 px-4 bg-gradient-to-b from-slate-800/95 via-slate-900 to-black/90">
                    <CameraOffAvatar name={remoteDisplayName} profileImageUrl={profileAvatarUrl} isGuest={isGuestPeer} />
                    <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} className="text-[10px] px-2.5 py-1" />
                    <p className="text-[10px] text-white/45 uppercase tracking-widest">Camera off</p>
                    <p className="text-white/85 text-sm font-medium">{remoteDisplayName}</p>
                </div>
            )}
            {peer.remoteStream && <AudioPlayer stream={peer.remoteStream} outputDeviceId={outputDeviceId} />}
            {isRemoteScreenShare && <div className="absolute top-3 left-3 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 z-[1]"><p className="text-[10px] text-emerald-200 font-semibold">Sharing screen</p></div>}
            {showLivePixels && (
                <div className="absolute bottom-3 left-3 right-14 glass-dark rounded-lg px-3 py-1.5 flex items-center gap-2 flex-wrap max-w-[min(100%,22rem)]">
                    <p className="text-white text-xs font-medium truncate">{remoteDisplayName}{isPinned ? ' (Pinned)' : ''}</p>
                    <RemoteVideoRoleBadge peerId={peerId} userRole={presenceRole} compact />
                </div>
            )}
            <button onClick={onPin} className="absolute top-3 right-3 bg-white/10 rounded-full p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity z-[2]" title={isPinned ? 'Unpin' : 'Pin'}>
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
        void applyAudioOutputToElement(el, outputDeviceId);

        const tryPlay = () => {
            el.muted = false;
            el.volume = 1;
            void applyAudioOutputToElement(el, outputDeviceId);
            void el.play().catch(() => undefined);
        };
        tryPlay();

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
                left: 0,
                bottom: 0,
                width: 1,
                height: 1,
                opacity: 0.01,
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
        const videoOnly = new MediaStream(stream.getVideoTracks());

        const bind = () => {
            el.setAttribute('playsinline', 'true');
            el.setAttribute('webkit-playsinline', 'true');
            el.muted = true;
            el.srcObject = videoOnly;
            void el.play().catch(() => undefined);
        };
        bind();

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
            cleanups.forEach((c) => c());
            el.srcObject = null;
        };
    }, [stream, isScreenSharing, videoTrackKey]);

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
                                    ? 'bg-indigo-500/30 text-white'
                                    : 'bg-white/5 text-white/90'
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
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 min-w-0"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}


// Participants panel showing connected users from Realtime presence
function ParticipantsPanel({
    participants,
    currentUserId,
    canModerateMeetingRoom = false,
    meetingCreatorId = null,
    selfUnmuteLocked = false,
    selfLiveTotalFromDb = 0,
    sessionSegmentStartMs = Date.now(),
    onAllowUnmutePeer,
    onKickPeer,
}: {
    participants: RoomParticipant[];
    currentUserId: string;
    canModerateMeetingRoom?: boolean;
    meetingCreatorId?: string | null;
    selfUnmuteLocked?: boolean;
    selfLiveTotalFromDb?: number;
    sessionSegmentStartMs?: number;
    onAllowUnmutePeer?: (userId: string) => void;
    onKickPeer?: (userId: string) => void;
}) {
    const sorted = [...participants].sort((a, b) => {
        if (a.userId === currentUserId) return -1;
        if (b.userId === currentUserId) return 1;
        const an = String(a.userName ?? '').trim() || 'Participant';
        const bn = String(b.userName ?? '').trim() || 'Participant';
        return an.localeCompare(bn);
    });

    const now = Date.now();

    return (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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
                    const isYou = p.userId === currentUserId;
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
                            key={p.userId}
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
            <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                    <DynamicLogo width={20} height={20} />
                    <p className="text-amber-200 text-xs font-semibold">IIChE AVVU SC Details</p>
                </div>
                <p className="text-white/80 text-xs">Fueled by Passion, Driven by Students</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-white/50 text-[11px] mb-2">Schedule</p>
                {scheduleOk ? (
                    <>
                        <p className="text-white/90 text-xs">{when.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
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
                    <div key={p.userId} className="rounded-lg border border-white/10 bg-white/5 p-2.5 flex items-center gap-2.5">
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
            <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-yellow-500/10 p-3">
                <p className="text-amber-200 text-xs font-semibold">Join Approval Requests</p>
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
