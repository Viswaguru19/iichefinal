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
} from 'lucide-react';
import { useWebRTC, type PeerState } from '@/hooks/useWebRTC';
import type { ChatMessage, RoomParticipant } from '@/hooks/useWebRTC';

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

    // Media state
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Panel state
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Ref to store the original camera track for restoring after screen share
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

    // WebRTC peer connections
    const { peers, participants, chatMessages, sendChatMessage, replaceVideoTrack } = useWebRTC({
        supabase,
        roomId,
        userId: currentUserId,
        userName: currentUserName,
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

                if (!accessResult.granted || !accessResult.meeting || !accessResult.userId) {
                    setAccessDenied(true);
                    setLoading(false);
                    return;
                }

                if (cancelled) return;

                const meetingData = accessResult.meeting;
                setMeeting(meetingData);
                setCurrentUserId(accessResult.userId);

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
        {
            icon: MonitorUp,
            label: isScreenSharing ? 'Stop Sharing' : 'Share Screen',
            onClick: toggleScreenShare,
            active: isScreenSharing,
        },
        {
            icon: MessageSquare,
            label: 'Chat',
            onClick: () => setIsChatOpen((prev) => !prev),
            active: isChatOpen,
        },
        {
            icon: Users,
            label: 'Participants',
            onClick: () => setIsParticipantListOpen((prev) => !prev),
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
                className="relative z-10 flex items-center justify-between px-6 py-3 glass-dark border-b border-white/5"
            >
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h1 className="text-white font-semibold text-sm truncate max-w-xs">
                        {meeting.title}
                    </h1>
                </div>
                <p className="text-white/40 text-xs">
                    Room: {roomId}
                </p>
            </motion.div>

            {/* Main content area */}
            <div className="flex-1 flex relative z-10 overflow-hidden">
                {/* Video grid area */}
                <motion.div
                    layout
                    className="flex-1 p-4 overflow-y-auto"
                >
                    <div className={`w-full h-full grid gap-3 ${peers.size === 0
                        ? 'grid-cols-1'
                        : peers.size <= 1
                            ? 'grid-cols-1 md:grid-cols-2'
                            : peers.size <= 3
                                ? 'grid-cols-2'
                                : 'grid-cols-2 md:grid-cols-3'
                        }`}>
                        {/* Local video */}
                        <div className="relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5 aspect-video">
                            {localStream && !isCameraOff ? (
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                        <VideoOff className="w-8 h-8 text-white" />
                                    </div>
                                    <p className="text-white/50 text-sm">
                                        {isCameraOff ? 'Camera is off' : 'No camera available'}
                                    </p>
                                </div>
                            )}
                            {/* Name tag */}
                            <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5">
                                <p className="text-white text-xs font-medium">You</p>
                            </div>
                            {/* Mute indicator */}
                            {isMuted && (
                                <div className="absolute top-3 right-3 bg-red-500/80 rounded-full p-1.5">
                                    <MicOff className="w-3 h-3 text-white" />
                                </div>
                            )}
                        </div>

                        {/* Remote peer videos */}
                        {Array.from(peers.entries()).map(([peerId, peer]) => (
                            <RemoteVideo key={peerId} peer={peer} />
                        ))}
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

                {/* Leave button — separated */}
                <div className="w-px h-8 bg-white/10 mx-2" />
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
function RemoteVideo({ peer }: { peer: PeerState }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && peer.remoteStream) {
            videoRef.current.srcObject = peer.remoteStream;
        }
    }, [peer.remoteStream]);

    const hasVideo = peer.remoteStream && peer.remoteStream.getVideoTracks().length > 0;

    return (
        <div className="relative rounded-2xl overflow-hidden bg-slate-900/80 border border-white/5 aspect-video">
            {hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <UserCircle className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-white/50 text-sm">Connecting...</p>
                </div>
            )}
            {/* Name tag */}
            <div className="absolute bottom-3 left-3 glass-dark rounded-lg px-3 py-1.5">
                <p className="text-white text-xs font-medium">{peer.userName}</p>
            </div>
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
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-[10px] font-bold">{initials}</span>
                            </div>
                            {/* Name + badge */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-medium truncate">
                                    {p.userName}
                                    {isYou && (
                                        <span className="ml-1.5 text-[10px] text-indigo-400 font-normal">(You)</span>
                                    )}
                                </p>
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
