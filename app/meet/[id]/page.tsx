'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
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
    Check,
    X,
    PanelLeftClose,
    PanelLeftOpen,
    Copy,
} from 'lucide-react';
import { useWebRTC, type PeerState } from '@/hooks/useWebRTC';
import type { ChatMessage, RoomParticipant } from '@/hooks/useWebRTC';
import DynamicLogo from '@/components/DynamicLogo';

interface Meeting {
    id: string;
    title: string;
    description: string | null;
    meeting_date: string;
    room_id: string | null;
    created_by: string | null;
    status: string;
    require_approval?: boolean | null;
}

type PendingJoinRequest =
    | { requestKind: 'member'; key: string; user_id: string; profiles?: { name?: string | null; email?: string | null } }
    | { requestKind: 'guest'; key: string; rowId: string; guest_id: string; display_name: string };

function guestSessionStorageKey(roomId: string) {
    return `avvu_meet_guest_${roomId}`;
}

export default function MeetingRoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomId = params.id as string;
    const supabase = createClient();

    // Core state
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserName, setCurrentUserName] = useState<string>('');
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
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

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const preJoinVideoRef = useRef<HTMLVideoElement>(null);

    // Ref to store the original camera track for restoring after screen share
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const screenTrackRef = useRef<MediaStreamTrack | null>(null);

    const ensureLocalMedia = useCallback(async () => {
        if (localStream) return localStream;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setIsMuted(false);
            setIsCameraOff(false);
            return stream;
        } catch {
            return null;
        }
    }, [localStream]);

    // WebRTC peer connections
    const { peers, participants, chatMessages, sendChatMessage, replaceVideoTrack } = useWebRTC({
        supabase,
        roomId,
        userId: currentUserId,
        userName: currentUserName,
        userRole: currentUserRole,
        localStream,
        enabled: !!meeting && !!currentUserId && !!currentUserName && hasJoinedMeeting,
    });

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
                            .select('name')
                            .eq('id', accessResult.userId)
                            .single();
                        setCurrentUserName(profile?.name || 'Member');
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
                                    try {
                                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                                        if (!cancelled) setLocalStream(stream);
                                    } catch {
                                        console.warn('Camera/mic permissions denied');
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
                setCurrentUserRole(accessResult.userRole || null);

                // 5. Fetch user profile name
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('id', accessResult.userId)
                    .single();
                if (!cancelled) {
                    setCurrentUserName(profile?.name || 'Anonymous');
                }

                // 6. Request camera/mic permissions
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                    if (!cancelled) {
                        setLocalStream(stream);
                    }
                } catch {
                    // User denied permissions — still allow entry, just no media
                    console.warn('Camera/mic permissions denied');
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

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

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
                    },
                    { onConflict: 'meeting_id,user_id' }
                );
        };
        void saveParticipant();
    }, [hasJoinedMeeting, meeting?.id, currentUserId]);

    // Cleanup media on unmount
    useEffect(() => {
        return () => {
            localStream?.getTracks().forEach((track) => track.stop());
        };
    }, [localStream]);

    const canApproveRequests =
        !!meeting?.require_approval &&
        !!currentUserId &&
        (meeting?.created_by === currentUserId || (!!currentUserRole && currentUserRole !== 'Guest'));

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
        const members = (mpRes.data || []).map(
            (r: { user_id: string; profiles?: { name?: string | null; email?: string | null } }) =>
                ({
                    requestKind: 'member' as const,
                    key: `m:${r.user_id}`,
                    user_id: r.user_id,
                    profiles: r.profiles,
                }),
        );
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
                setCurrentUserRole(next.userRole || null);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('id', next.userId)
                    .single();
                if (!cancelled) {
                    setCurrentUserName(profile?.name || 'Member');
                }
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    if (!cancelled) {
                        setLocalStream(stream);
                    }
                } catch {
                    // Media permissions can be requested again from pre-join controls.
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
    }, [pendingApproval, roomId]);

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
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    if (!cancelled) setLocalStream(stream);
                } catch {
                    console.warn('Camera/mic permissions denied');
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
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(analyser);
        const arr = new Uint8Array(analyser.frequencyBinCount);
        let raf = 0;
        const tick = () => {
            analyser.getByteFrequencyData(arr);
            let sum = 0;
            for (let i = 0; i < arr.length; i++) sum += arr[i];
            const avg = sum / arr.length;
            setMicLevel(Math.min(100, Math.round((avg / 255) * 180)));
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => {
            cancelAnimationFrame(raf);
            source.disconnect();
            analyser.disconnect();
            ctx.close().catch(() => undefined);
        };
    }, [localStream, isMuted]);

    // Media controls
    const toggleMute = useCallback(() => {
        const run = async () => {
            const stream = await ensureLocalMedia();
            if (!stream) return;
            stream.getAudioTracks().forEach((track) => {
                track.enabled = !track.enabled;
            });
            setIsMuted((prev) => !prev);
        };
        run();
    }, [ensureLocalMedia]);

    const toggleCamera = useCallback(() => {
        const run = async () => {
            const stream = await ensureLocalMedia();
            if (!stream) return;
            stream.getVideoTracks().forEach((track) => {
                track.enabled = !track.enabled;
            });
            setIsCameraOff((prev) => !prev);
        };
        run();
    }, [ensureLocalMedia]);

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

                // Update local video element
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = new MediaStream([screenTrack]);
                }
                setLocalPreviewStream(new MediaStream([screenTrack]));

                // Auto-revert when user stops sharing via browser UI
                screenTrack.onended = async () => {
                    const camTrack = cameraTrackRef.current;
                    if (camTrack) {
                        await replaceVideoTrack(camTrack);
                        if (localVideoRef.current) {
                            localVideoRef.current.srcObject = activeStream;
                        }
                        setLocalPreviewStream(activeStream);
                        cameraTrackRef.current = null;
                    }
                    screenTrackRef.current = null;
                    setIsScreenSharing(false);
                };

                setIsScreenSharing(true);
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
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = activeStream;
                }
                setLocalPreviewStream(activeStream);
                cameraTrackRef.current = null;
            }
            screenTrack?.stop();
            screenTrackRef.current = null;
            setIsScreenSharing(false);
        }
    }, [localStream, ensureLocalMedia, isScreenSharing, replaceVideoTrack]);

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
                    <p className="text-white/60 text-sm mb-4">{meeting.title}</p>
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

            if (meeting.require_approval) {
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
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
            } catch {
                console.warn('Camera/mic denied');
            }
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
                        {meeting?.require_approval ? (
                            <span className="block mt-2 text-amber-200/70">
                                This meeting requires approval: you will get a <strong className="text-amber-100">guest ID</strong> so the organizer can approve you in the Approvals panel.
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
                            <h2 className="text-amber-100 text-lg sm:text-xl font-bold">{meeting.title}</h2>
                        </div>
                        <button onClick={() => router.push('/dashboard/meetings')} className="text-amber-100/90 hover:text-amber-200 text-xs border border-amber-300/30 rounded-lg px-3 py-1.5">Back</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
                        <div className="relative rounded-xl overflow-hidden bg-black/40 border border-amber-200/20 aspect-video">
                            {localStream && !isCameraOff ? <video ref={preJoinVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-3"><VideoOff className="w-8 h-8 text-white/60" /><p className="text-white/50 text-sm">{isCameraOff ? 'Camera off' : 'No camera preview'}</p></div>}
                        </div>
                        <div className="rounded-xl border border-amber-200/20 bg-gradient-to-b from-zinc-900/70 to-black/60 p-4 space-y-4">
                            <div>
                                <p className="text-amber-100/90 text-xs mb-2">Microphone Level</p>
                                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                                    <div className={`${micLevel > 70 ? 'bg-amber-300' : micLevel > 35 ? 'bg-yellow-400' : 'bg-slate-300'} h-full`} style={{ width: `${isMuted ? 0 : micLevel}%` }} />
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-50/70"><Volume2 className="w-3.5 h-3.5" /><span>{isMuted ? 'Muted' : `${micLevel}% input`}</span></div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={toggleMute} className="px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-slate-300/30 text-slate-100 text-xs">{isMuted ? 'Unmute Mic' : 'Mute Mic'}</button>
                                <button onClick={toggleCamera} className="px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-slate-300/30 text-slate-100 text-xs">{isCameraOff ? 'Start Camera' : 'Stop Camera'}</button>
                                {!localStream && (
                                    <button onClick={ensureLocalMedia} className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-300/35 text-xs">
                                        Enable Camera & Mic
                                    </button>
                                )}
                            </div>
                            <button onClick={() => setHasJoinedMeeting(true)} className="w-full btn-gradient-amber px-4 py-2.5 rounded-xl text-sm font-semibold">Join Meeting</button>
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
    ];

    return (
        <div className="min-h-[100dvh] bg-[#050505] flex flex-col overflow-hidden relative">
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
                            <p className="text-amber-50 text-sm font-semibold">{meeting.title}</p>
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
                        {meeting.title}
                    </h1>
                    {isScreenSharing && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                            You are sharing screen
                        </span>
                    )}
                </div>
                <p className="text-white/40 text-xs hidden sm:block">
                    Room: {roomId.slice(0, 8)}...
                </p>
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
                            <div className="flex-1 min-h-0"><RemoteVideo peer={peers.get(pinnedPeerId)!} isPinned={true} onPin={() => setPinnedPeerId(null)} /></div>
                        )}
                        {pinnedPeerId === 'local' && (
                            <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5">
                                <LocalVideoTile stream={localPreviewStream || localStream} isCameraOff={isCameraOff} isScreenSharing={isScreenSharing} />
                                <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5"><p className="text-white text-xs font-medium">You (Pinned)</p></div>
                                <button onClick={() => setPinnedPeerId(null)} className="absolute top-3 right-3 bg-indigo-500/80 rounded-full p-1.5 hover:bg-indigo-500"><PinOff className="w-3 h-3 text-white" /></button>
                                {isMuted && <div className="absolute top-3 left-3 bg-red-500/80 rounded-full p-1.5"><MicOff className="w-3 h-3 text-white" /></div>}
                            </div>
                        )}
                        {pinnedPeerId && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {pinnedPeerId !== 'local' && (
                                    <div className="relative rounded-xl overflow-hidden bg-slate-900/80 border border-white/5 w-40 h-24 flex-shrink-0 cursor-pointer" onClick={() => setPinnedPeerId('local')}>
                                        <LocalVideoTile stream={localPreviewStream || localStream} isCameraOff={isCameraOff} isScreenSharing={isScreenSharing} compact />
                                        <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5"><p className="text-white text-[10px]">You</p></div>
                                    </div>
                                )}
                                {Array.from(peers.entries()).filter(([pid]) => pid !== pinnedPeerId).map(([pid, peer]) => (
                                    <RemoteVideo key={pid} peer={peer} isPinned={false} onPin={() => setPinnedPeerId(pid)} small />
                                ))}
                            </div>
                        )}
                        {!pinnedPeerId && (<>
                            <div className="relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5 aspect-video group">
                                <LocalVideoTile stream={localPreviewStream || localStream} isCameraOff={isCameraOff} isScreenSharing={isScreenSharing} />
                                <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5"><p className="text-white text-xs font-medium">You</p></div>
                                {isMuted && <div className="absolute top-3 right-3 bg-red-500/80 rounded-full p-1.5"><MicOff className="w-3 h-3 text-white" /></div>}
                                <button onClick={() => setPinnedPeerId('local')} className="absolute top-3 left-3 bg-white/10 rounded-full p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity"><Pin className="w-3 h-3 text-white" /></button>
                            </div>
                            {Array.from(peers.entries()).map(([pid, peer]) => (<RemoteVideo key={pid} peer={peer} isPinned={false} onPin={() => setPinnedPeerId(pid)} />))}
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
                                />
                            ) : isParticipantListOpen ? (
                                <ParticipantsPanel
                                    participants={participants}
                                    currentUserId={currentUserId}
                                />
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
                                <ParticipantsPanel
                                    participants={participants}
                                    currentUserId={currentUserId}
                                />
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

// Separate component for remote video to manage its own ref
function RemoteVideo({ peer, isPinned, onPin, small }: { peer: PeerState; isPinned: boolean; onPin: () => void; small?: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasVideo, setHasVideo] = useState(false);
    const [isRemoteScreenShare, setIsRemoteScreenShare] = useState(false);

    useEffect(() => {
        if (!peer.remoteStream) return;

        const check = () => {
            const tracks = peer.remoteStream?.getVideoTracks() || [];
            setHasVideo(tracks.length > 0 && tracks.some(t => t.readyState === 'live'));
            const sharing = tracks.some((track) => {
                const settings = track.getSettings?.() as MediaTrackSettings | undefined;
                const displaySurface = settings?.displaySurface;
                const label = (track.label || '').toLowerCase();
                return displaySurface === 'monitor' || displaySurface === 'window' || displaySurface === 'browser' || label.includes('screen') || label.includes('window') || label.includes('tab');
            });
            setIsRemoteScreenShare(sharing);
        };
        check();
        peer.remoteStream.onaddtrack = check;
        peer.remoteStream.onremovetrack = check;
        // Poll for track state changes (enabled/muted don't fire events)
        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    }, [peer.remoteStream]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el || !peer.remoteStream) return;
        el.srcObject = peer.remoteStream;
        void el.play().catch(() => undefined);
    }, [peer.remoteStream]);

    if (small) {
        return (
            <div className="relative rounded-xl overflow-hidden bg-slate-900/80 border border-white/5 w-40 h-24 flex-shrink-0 cursor-pointer group" onClick={onPin}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ display: hasVideo ? 'block' : 'none' }} />
                {!hasVideo && <div className="w-full h-full flex items-center justify-center"><UserCircle className="w-6 h-6 text-white/40" /></div>}
                {peer.remoteStream && <AudioPlayer stream={peer.remoteStream} />}
                {isRemoteScreenShare && <div className="absolute top-1 left-1 rounded-md border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5"><p className="text-[9px] text-emerald-200 font-semibold">Sharing</p></div>}
                <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5"><p className="text-white text-[10px]">{peer.userName}</p></div>
            </div>
        );
    }

    return (
        <div className={`relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5 ${isPinned ? 'w-full h-full' : 'aspect-video'} group`}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ display: hasVideo ? 'block' : 'none' }} />
            {!hasVideo && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"><UserCircle className="w-8 h-8 text-white" /></div>
                    <p className="text-white/50 text-sm">{peer.userName}</p>
                </div>
            )}
            {peer.remoteStream && <AudioPlayer stream={peer.remoteStream} />}
            {isRemoteScreenShare && <div className="absolute top-3 left-3 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-1"><p className="text-[10px] text-emerald-200 font-semibold">Sharing screen</p></div>}
            <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5"><p className="text-white text-xs font-medium">{peer.userName}{isPinned ? ' (Pinned)' : ''}</p></div>
            <button onClick={onPin} className="absolute top-3 right-3 bg-white/10 rounded-full p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity" title={isPinned ? 'Unpin' : 'Pin'}>
                {isPinned ? <PinOff className="w-3 h-3 text-white" /> : <Pin className="w-3 h-3 text-white" />}
            </button>
        </div>
    );
}

// Separate audio element to guarantee audio playback even when video is hidden
function AudioPlayer({ stream }: { stream: MediaStream }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        el.srcObject = stream;
        void el.play().catch(() => undefined);
    }, [stream]);
    return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

function LocalVideoTile({
    stream,
    isCameraOff,
    isScreenSharing = false,
    compact = false,
}: {
    stream: MediaStream | null;
    isCameraOff: boolean;
    isScreenSharing?: boolean;
    compact?: boolean;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || !stream) return;
        el.srcObject = null;
        el.srcObject = stream;
        void el.play().catch(() => undefined);
    }, [stream, isCameraOff, isScreenSharing]);
    if (stream && (!isCameraOff || isScreenSharing)) {
        return <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" />;
    }
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className={`${compact ? 'w-8 h-8' : 'w-20 h-20'} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center`}>
                <VideoOff className={`${compact ? 'w-4 h-4' : 'w-8 h-8'} text-white`} />
            </div>
            {!compact && <p className="text-white/50 text-sm">{isCameraOff ? 'Camera is off' : 'No camera'}</p>}
        </div>
    );
}

// Chat panel component for in-room messaging
function ChatPanel({
    messages,
    currentUserId,
    onSend,
}: {
    messages: ChatMessage[];
    currentUserId: string;
    onSend: (message: string) => void;
}) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSend(input);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center h-full">
                        <p className="text-white/30 text-xs text-center">
                            No messages yet. Start the conversation!
                        </p>
                    </div>
                )}
                {messages.map((msg) => {
                    const isOwn = msg.senderId === currentUserId;
                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                        >
                            {!isOwn && (
                                <span className="text-[10px] text-white/40 mb-0.5 px-1">
                                    {msg.senderName}
                                </span>
                            )}
                            <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs break-words ${isOwn
                                    ? 'bg-indigo-500/30 text-white'
                                    : 'bg-white/5 text-white/90'
                                    }`}
                            >
                                {msg.message}
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
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
}: {
    participants: RoomParticipant[];
    currentUserId: string;
}) {
    // Sort: current user first, then alphabetical
    const sorted = [...participants].sort((a, b) => {
        if (a.userId === currentUserId) return -1;
        if (b.userId === currentUserId) return 1;
        return a.userName.localeCompare(b.userName);
    });

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {sorted.length === 0 && (
                    <div className="flex-1 flex items-center justify-center h-full">
                        <p className="text-white/30 text-xs text-center">
                            No participants connected yet
                        </p>
                    </div>
                )}
                {sorted.map((p) => {
                    const isYou = p.userId === currentUserId;
                    const initials = p.userName
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                    return (
                        <div
                            key={p.userId}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.userRole === 'Guest' ? 'bg-gradient-to-br from-gray-500 to-gray-600' :
                                p.userRole === 'Faculty' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                                    p.userRole ? 'bg-gradient-to-br from-amber-400 to-yellow-500' :
                                        'bg-gradient-to-br from-indigo-500 to-purple-600'
                                }`}>
                                <span className="text-white text-[10px] font-bold">{initials}</span>
                            </div>
                            {/* Name + role badge */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-white text-xs font-medium truncate">
                                        {p.userName}
                                        {isYou && <span className="ml-1 text-[10px] text-indigo-400 font-normal">(You)</span>}
                                    </p>
                                    {p.userRole && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${p.userRole === 'Guest' ? 'bg-gray-500/30 text-gray-300' :
                                            p.userRole === 'Faculty' ? 'bg-amber-500/30 text-amber-300' :
                                                p.userRole === 'Admin' ? 'bg-red-500/30 text-red-300' :
                                                    'bg-yellow-500/30 text-yellow-300'
                                            }`}>
                                            {p.userRole === 'Guest' ? '👤 Guest' :
                                                p.userRole === 'Faculty' ? '🎓 Faculty' :
                                                    p.userRole === 'Admin' ? '🛡️ Admin' :
                                                        `👑 ${p.userRole}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Online indicator */}
                            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
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
    const when = new Date(meeting.meeting_date);
    return (
        <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${expanded ? 'max-w-4xl mx-auto w-full' : ''}`}>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-white/50 text-[11px] mb-1">Meeting Title</p>
                <p className="text-white text-sm font-semibold">{meeting.title}</p>
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
                <p className="text-white/90 text-xs">{when.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-white/70 text-xs mt-1">{when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
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
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        src.connect(analyser);
        const arr = new Uint8Array(analyser.frequencyBinCount);
        let raf = 0;
        const loop = () => {
            analyser.getByteFrequencyData(arr);
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            setLevel(Math.min(100, Math.round((avg / 255) * 180)));
            raf = requestAnimationFrame(loop);
        };
        loop();
        return () => {
            cancelAnimationFrame(raf);
            src.disconnect();
            analyser.disconnect();
            ctx.close().catch(() => undefined);
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
        return a.userName.localeCompare(b.userName);
    });
    if (sorted.length === 0) return <p className="text-white/30 text-xs">No participants connected yet.</p>;
    return (
        <div className="grid grid-cols-1 gap-2">
            {sorted.map((p) => {
                const initials = p.userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
                const isYou = p.userId === currentUserId;
                return (
                    <div key={p.userId} className="rounded-lg border border-white/10 bg-white/5 p-2.5 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><span className="text-white text-[10px] font-bold">{initials}</span></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-white text-xs truncate">{p.userName}{isYou && <span className="ml-1 text-indigo-300">(You)</span>}</p>
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
