'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { checkMeetingAccess } from '@/lib/meeting-access';
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
    const [guestName, setGuestName] = useState('');

    // Media state
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Panel state
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);

    // Pin state
    const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Ref to store the original camera track for restoring after screen share
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

    // WebRTC peer connections
    const { peers, participants, chatMessages, sendChatMessage, replaceVideoTrack } = useWebRTC({
        supabase,
        roomId,
        userId: currentUserId,
        userName: currentUserName,
        userRole: currentUserRole,
        localStream,
        enabled: !!meeting && !!currentUserId,
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
                    setLoading(false);
                    return;
                }

                if (accessResult.reason === 'guest_allowed') {
                    setMeeting(accessResult.meeting);
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

    // Cleanup media on unmount
    useEffect(() => {
        return () => {
            localStream?.getTracks().forEach((track) => track.stop());
        };
    }, [localStream]);

    // Media controls
    const toggleMute = useCallback(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach((track) => {
                track.enabled = !track.enabled;
            });
            setIsMuted((prev) => !prev);
        }
    }, [localStream]);

    const toggleCamera = useCallback(() => {
        if (localStream) {
            localStream.getVideoTracks().forEach((track) => {
                track.enabled = !track.enabled;
            });
            setIsCameraOff((prev) => !prev);
        }
    }, [localStream]);

    const toggleScreenShare = useCallback(async () => {
        if (!localStream) return;

        if (!isScreenSharing) {
            // Start screen sharing
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                // Save the original camera track so we can restore it later
                const originalCameraTrack = localStream.getVideoTracks()[0];
                cameraTrackRef.current = originalCameraTrack;

                // Replace the video track in the local stream
                localStream.removeTrack(originalCameraTrack);
                localStream.addTrack(screenTrack);

                // Replace the video track in all peer connections
                await replaceVideoTrack(screenTrack);

                // Update local video element
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }

                // Auto-revert when user stops sharing via browser UI
                screenTrack.onended = async () => {
                    const camTrack = cameraTrackRef.current;
                    if (camTrack) {
                        localStream.removeTrack(screenTrack);
                        localStream.addTrack(camTrack);
                        await replaceVideoTrack(camTrack);
                        if (localVideoRef.current) {
                            localVideoRef.current.srcObject = localStream;
                        }
                        cameraTrackRef.current = null;
                    }
                    setIsScreenSharing(false);
                };

                setIsScreenSharing(true);
            } catch {
                // User cancelled the screen share picker
                console.warn('Screen sharing cancelled or failed');
            }
        } else {
            // Stop screen sharing — restore camera track
            const screenTrack = localStream.getVideoTracks()[0];
            const camTrack = cameraTrackRef.current;

            if (camTrack) {
                localStream.removeTrack(screenTrack);
                screenTrack.stop();
                localStream.addTrack(camTrack);
                await replaceVideoTrack(camTrack);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }
                cameraTrackRef.current = null;
            }

            setIsScreenSharing(false);
        }
    }, [localStream, isScreenSharing, replaceVideoTrack]);

    const leaveMeeting = useCallback(() => {
        // Stop all local media tracks (camera, mic, screen share)
        localStream?.getTracks().forEach((track) => track.stop());
        // Also stop the saved camera track if screen sharing was active
        cameraTrackRef.current?.stop();
        cameraTrackRef.current = null;
        setLocalStream(null);
        router.push('/dashboard/meetings');
    }, [localStream, router]);

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

    // Guest entry screen
    if (showGuestEntry) {
        const joinAsGuest = async () => {
            if (!guestName.trim()) return;
            setShowGuestEntry(false);
            setLoading(true);
            setCurrentUserId(`guest-${Date.now()}`);
            setCurrentUserName(guestName.trim());
            setCurrentUserRole('Guest');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
            } catch { console.warn('Camera/mic denied'); }
            setLoading(false);
        };

        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-dark rounded-2xl p-8 max-w-md w-full text-center">
                    <UserCircle className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Join as Guest</h2>
                    <p className="text-white/60 text-sm mb-6">{meeting?.title}</p>
                    <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && joinAsGuest()}
                        placeholder="Enter your name" autoFocus
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 outline-none focus:border-indigo-500 mb-4 text-center" />
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={joinAsGuest} disabled={!guestName.trim()}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-40">
                        Join Meeting
                    </motion.button>
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

    // Check if screen sharing is supported (not on most mobile browsers)
    const canScreenShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

    // Control bar buttons config
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
        ...(canScreenShare ? [{
            icon: MonitorUp,
            label: isScreenSharing ? 'Stop Sharing' : 'Share Screen',
            onClick: toggleScreenShare,
            active: isScreenSharing,
        }] : []),
        {
            icon: MessageSquare,
            label: 'Chat',
            onClick: () => setIsChatOpen((prev: boolean) => !prev),
            active: isChatOpen,
        },
        {
            icon: Users,
            label: 'Participants',
            onClick: () => setIsParticipantListOpen((prev: boolean) => !prev),
            active: isParticipantListOpen,
        },
    ];

    return (
        <div className="h-screen bg-slate-950 flex flex-col overflow-hidden relative">
            {/* Background gradients */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
            </div>

            {/* Top bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-2.5 glass-dark border-b border-white/5"
            >
                <div className="flex items-center gap-3">
                    <DynamicLogo width={28} height={28} />
                    <span className="text-white/90 font-bold text-sm hidden sm:block">IIChE AVVU SC</span>
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h1 className="text-white font-semibold text-sm truncate max-w-[200px] sm:max-w-xs">
                        {meeting.title}
                    </h1>
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
                    className="flex-1 p-4 overflow-y-auto"
                >
                    <div className={`w-full h-full ${pinnedPeerId ? 'flex flex-col gap-3' : `grid gap-3 ${peers.size === 0 ? 'grid-cols-1' : peers.size <= 1 ? 'grid-cols-1 md:grid-cols-2' : peers.size <= 3 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}`}>
                        {pinnedPeerId && pinnedPeerId !== 'local' && peers.has(pinnedPeerId) && (
                            <div className="flex-1 min-h-0"><RemoteVideo peer={peers.get(pinnedPeerId)!} isPinned={true} onPin={() => setPinnedPeerId(null)} /></div>
                        )}
                        {pinnedPeerId === 'local' && (
                            <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5">
                                {localStream && !isCameraOff ? (<video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />) : (<div className="w-full h-full flex flex-col items-center justify-center gap-3"><div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><VideoOff className="w-8 h-8 text-white" /></div></div>)}
                                <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5"><p className="text-white text-xs font-medium">You (Pinned)</p></div>
                                <button onClick={() => setPinnedPeerId(null)} className="absolute top-3 right-3 bg-indigo-500/80 rounded-full p-1.5 hover:bg-indigo-500"><PinOff className="w-3 h-3 text-white" /></button>
                                {isMuted && <div className="absolute top-3 left-3 bg-red-500/80 rounded-full p-1.5"><MicOff className="w-3 h-3 text-white" /></div>}
                            </div>
                        )}
                        {pinnedPeerId && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {pinnedPeerId !== 'local' && (
                                    <div className="relative rounded-xl overflow-hidden bg-slate-900/80 border border-white/5 w-40 h-24 flex-shrink-0 cursor-pointer" onClick={() => setPinnedPeerId('local')}>
                                        {localStream && !isCameraOff ? (<video ref={pinnedPeerId !== 'local' ? localVideoRef : undefined} autoPlay playsInline muted className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center"><VideoOff className="w-5 h-5 text-white/40" /></div>)}
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
                                {localStream && !isCameraOff ? (<video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />) : (<div className="w-full h-full flex flex-col items-center justify-center gap-3"><div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><VideoOff className="w-8 h-8 text-white" /></div><p className="text-white/50 text-sm">{isCameraOff ? 'Camera is off' : 'No camera'}</p></div>)}
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
                    {(isChatOpen || isParticipantListOpen) && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="h-full border-l border-white/5 glass-dark overflow-hidden flex flex-col"
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
                            </div>

                            {/* Panel content */}
                            {isChatOpen ? (
                                <ChatPanel
                                    messages={chatMessages}
                                    currentUserId={currentUserId}
                                    onSend={sendChatMessage}
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
                className="relative z-10 flex items-center justify-center gap-3 px-6 py-4 glass-dark border-t border-white/5"
            >
                {controls.map((ctrl) => (
                    <motion.button
                        key={ctrl.label}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={ctrl.onClick}
                        title={ctrl.label}
                        className={`p-3 rounded-xl transition-all ${ctrl.danger
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : ctrl.active
                                ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                            }`}
                    >
                        <ctrl.icon className="w-5 h-5" />
                    </motion.button>
                ))}

                {/* Invite & Leave */}
                <div className="w-px h-8 bg-white/10 mx-2" />
                <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        const link = `${window.location.origin}/meet/${roomId}`;
                        navigator.clipboard.writeText(link);
                        import('react-hot-toast').then(m => m.default.success('Meeting link copied!'));
                    }}
                    title="Copy Meeting Link"
                    className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-all"
                >
                    <Link2 className="w-5 h-5" />
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={leaveMeeting}
                    title="Leave Meeting"
                    className="px-5 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-2 text-sm font-semibold"
                >
                    <LogOut className="w-5 h-5" />
                    Leave
                </motion.button>
            </motion.div>
        </div>
    );
}

// Separate component for remote video to manage its own ref
function RemoteVideo({ peer, isPinned, onPin, small }: { peer: PeerState; isPinned: boolean; onPin: () => void; small?: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        if (videoRef.current && peer.remoteStream) {
            videoRef.current.srcObject = peer.remoteStream;
            setHasVideo(peer.remoteStream.getVideoTracks().some(t => t.enabled && !t.muted));
            const checkTracks = () => { setHasVideo(peer.remoteStream!.getVideoTracks().some(t => t.enabled && !t.muted)); };
            peer.remoteStream.onaddtrack = checkTracks;
            peer.remoteStream.onremovetrack = checkTracks;
        }
    }, [peer.remoteStream]);

    if (small) {
        return (
            <div className="relative rounded-xl overflow-hidden bg-slate-900/80 border border-white/5 w-40 h-24 flex-shrink-0 cursor-pointer group" onClick={onPin}>
                <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${hasVideo ? '' : 'hidden'}`} />
                {!hasVideo && <div className="w-full h-full flex items-center justify-center"><UserCircle className="w-6 h-6 text-white/40" /></div>}
                {peer.remoteStream && <AudioPlayer stream={peer.remoteStream} />}
                <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5"><p className="text-white text-[10px]">{peer.userName}</p></div>
            </div>
        );
    }

    return (
        <div className={`relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5 ${isPinned ? 'w-full h-full' : 'aspect-video'} group`}>
            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${hasVideo ? '' : 'hidden'}`} />
            {!hasVideo && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"><UserCircle className="w-8 h-8 text-white" /></div>
                    <p className="text-white/50 text-sm">{peer.userName}</p>
                </div>
            )}
            {peer.remoteStream && <AudioPlayer stream={peer.remoteStream} />}
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
        if (audioRef.current) {
            audioRef.current.srcObject = stream;
        }
    }, [stream]);
    return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
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
