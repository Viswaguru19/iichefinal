'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

function iceConfig(): RTCConfiguration {
    const iceServers: RTCIceServer[] = [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:freeturn.net:3478' },
        { urls: 'turn:freeturn.net:3478', username: 'free', credential: 'free' },
        { urls: 'turns:freeturn.net:5349', username: 'free', credential: 'free' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    ];
    const turnUrls = (process.env.NEXT_PUBLIC_TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME || '';
    const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '';
    if (turnUrls.length && turnUser && turnCred) {
        iceServers.push({ urls: turnUrls, username: turnUser, credential: turnCred });
    }
    return { iceServers, iceCandidatePoolSize: 10 };
}

function senderForKind(pc: RTCPeerConnection, kind: string): RTCRtpSender | undefined {
    const withTrack = pc.getSenders().find((s) => s.track?.kind === kind);
    if (withTrack) return withTrack;
    return pc.getTransceivers().find((t) => t.receiver.track?.kind === kind)?.sender;
}

async function attachTrackToPeer(pc: RTCPeerConnection, track: MediaStreamTrack, stream: MediaStream) {
    const sender = senderForKind(pc, track.kind);
    if (sender) {
        const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
        if (transceiver && transceiver.direction !== 'sendrecv') transceiver.direction = 'sendrecv';
        await sender.replaceTrack(track);
        return;
    }
    pc.addTrack(track, stream);
}

async function replaceKindTrack(pc: RTCPeerConnection, kind: 'audio' | 'video', track: MediaStreamTrack | null) {
    const sender = senderForKind(pc, kind);
    if (sender) {
        const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
        if (transceiver && track && transceiver.direction !== 'sendrecv') transceiver.direction = 'sendrecv';
        await sender.replaceTrack(track);
        return;
    }
    if (track) pc.addTrack(track, new MediaStream([track]));
}

async function attachLocalTracksToPeer(pc: RTCPeerConnection, local: MediaStream | null) {
    if (!local) return;
    const audio = local.getAudioTracks().find((t) => t.readyState === 'live') ?? null;
    const video = local.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    if (audio) await attachTrackToPeer(pc, audio, local);
    if (video) await attachTrackToPeer(pc, video, local);
    else await replaceKindTrack(pc, 'video', null);
}

function sdpJson(desc: RTCSessionDescription | RTCSessionDescriptionInit | null | undefined) {
    if (!desc?.type || !desc.sdp) return null;
    return { type: desc.type, sdp: desc.sdp };
}

export interface PeerState {
    connection: RTCPeerConnection;
    remoteStream: MediaStream | null;
    userName: string;
    connectionState: RTCPeerConnectionState;
}
export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    /** Caption or text-only body */
    message: string;
    timestamp: string;
    attachmentUrl?: string | null;
    attachmentKind?: 'image' | 'file' | null;
    fileName?: string | null;
}

export type SendChatPayload =
    | string
    | {
          message?: string;
          attachmentUrl: string;
          attachmentKind: 'image' | 'file';
          fileName: string;
      };
export interface RoomParticipant { userId: string; userName: string; userRole?: string | null; joinedAt: string; }
export type RoomControlAction = 'mute-all' | 'allow-unmute' | 'allow-unmute-peer' | 'kick-peer';
/** Who sent mute-all: creator spares EC/faculty; EC/faculty spares meeting creator. */
export type MuteAllPolicy = 'creator' | 'ec_faculty';
export interface RoomControlPayload {
    action: RoomControlAction;
    senderId: string;
    senderName: string;
    timestamp: string;
    /** For allow-unmute-peer and kick-peer */
    targetUserId?: string;
    /** mute-all: receiver uses this to decide exemptions */
    mutePolicy?: MuteAllPolicy;
}

export interface SendRoomControlOptions {
    mutePolicy?: MuteAllPolicy;
}

interface UseWebRTCOptions {
    supabase: SupabaseClient; roomId: string; userId: string; userName: string;
    userRole?: string | null; localStream: MediaStream | null; enabled: boolean;
    onRoomControl?: (payload: RoomControlPayload) => void;
    /** Read fresh each call — used when someone joins so we broadcast whether we are sending camera/screen video. */
    getCameraSendingSnapshot?: () => boolean;
}

export function useWebRTC({
    supabase,
    roomId,
    userId,
    userName,
    userRole,
    localStream,
    enabled,
    onRoomControl,
    getCameraSendingSnapshot,
}: UseWebRTCOptions) {
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<RoomParticipant[]>([]);
    /** Explicit per-peer “sending visible video” from signaling; false = show avatar for everyone. */
    const [peerCameraSendingVideo, setPeerCameraSendingVideo] = useState<Record<string, boolean>>({});
    const peersRef = useRef<Map<string, PeerState>>(new Map());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const userIdRef = useRef(userId);
    const userNameRef = useRef(userName);
    const onRoomControlRef = useRef(onRoomControl);
    const getCameraSendingSnapshotRef = useRef(getCameraSendingSnapshot);
    const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const makingOfferRef = useRef<Set<string>>(new Set());

    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { userNameRef.current = userName; }, [userName]);
    useEffect(() => { onRoomControlRef.current = onRoomControl; }, [onRoomControl]);
    useEffect(() => {
        getCameraSendingSnapshotRef.current = getCameraSendingSnapshot;
    }, [getCameraSendingSnapshot]);

    const syncPeers = useCallback(() => { setPeers(new Map(peersRef.current)); }, []);

    /** Supabase presence values are usually arrays of metas; guard other shapes so sync never throws. */
    function metasFromPresenceValue(raw: unknown): Record<string, unknown>[] {
        if (raw == null) return [];
        if (Array.isArray(raw)) return raw.filter((x): x is Record<string, unknown> => x != null && typeof x === 'object');
        if (typeof raw === 'object') return [raw as Record<string, unknown>];
        return [];
    }

    function queueIce(peerId: string, candidate: RTCIceCandidateInit) {
        const list = pendingIceRef.current.get(peerId) ?? [];
        list.push(candidate);
        pendingIceRef.current.set(peerId, list);
    }

    async function flushIce(peerId: string, pc: RTCPeerConnection) {
        const list = pendingIceRef.current.get(peerId) ?? [];
        pendingIceRef.current.delete(peerId);
        for (const c of list) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (err) {
                console.error('ICE flush error:', err);
            }
        }
    }

    async function sendSignal(event: string, payload: Record<string, unknown>) {
        const ch = channelRef.current;
        if (!ch) return;
        try {
            await ch.send({ type: 'broadcast', event, payload });
        } catch (err) {
            console.error(`Signal ${event} failed:`, err);
        }
    }

    // These are NOT useCallbacks — they use refs so they never go stale
    function createPC(peerId: string, peerName: string): RTCPeerConnection | null {
        try {
            if (typeof RTCPeerConnection === 'undefined') {
                console.warn('RTCPeerConnection is not available (requires a secure context and a supported browser).');
                return null;
            }
            const safeName = String(peerName ?? '').trim() || 'Participant';
            const pc = new RTCPeerConnection(iceConfig());
            const audioTr = pc.addTransceiver('audio', { direction: 'sendrecv' });
            const videoTr = pc.addTransceiver('video', { direction: 'sendrecv' });
            const local = localStreamRef.current;
            const audioTrack = local?.getAudioTracks().find((t) => t.readyState === 'live');
            const videoTrack = local?.getVideoTracks().find((t) => t.readyState === 'live');
            if (audioTrack) void audioTr.sender.replaceTrack(audioTrack);
            if (videoTrack) void videoTr.sender.replaceTrack(videoTrack);

            const remoteStream = new MediaStream();
            let negotiationBusy = false;
            pc.onnegotiationneeded = async () => {
                // Initial SDP is driven by the offerer; this handles late camera/mic attach.
                if (!pc.remoteDescription || pc.signalingState !== 'stable' || negotiationBusy) return;
                const polite = userIdRef.current > peerId;
                if (polite) return;
                negotiationBusy = true;
                makingOfferRef.current.add(peerId);
                try {
                    await pc.setLocalDescription(await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }));
                    const sdp = sdpJson(pc.localDescription);
                    if (sdp) {
                        await sendSignal('sdp-offer', {
                            senderId: userIdRef.current,
                            senderName: userNameRef.current,
                            targetId: peerId,
                            sdp,
                        });
                    }
                } catch (e) {
                    console.error('Renegotiation offer error:', e);
                } finally {
                    makingOfferRef.current.delete(peerId);
                    negotiationBusy = false;
                }
            };
            pc.ontrack = (event) => {
                const incoming = event.streams?.[0]?.getTracks()?.length
                    ? event.streams[0].getTracks()
                    : event.track
                        ? [event.track]
                        : [];
                for (const track of incoming) {
                    if (remoteStream.getTracks().some((t) => t.id === track.id)) continue;
                    remoteStream.addTrack(track);
                    track.onunmute = () => syncPeers();
                    track.onmute = () => syncPeers();
                    track.onended = () => syncPeers();
                }
                const ex = peersRef.current.get(peerId);
                if (ex) {
                    ex.remoteStream = remoteStream;
                    peersRef.current.set(peerId, { ...ex });
                    syncPeers();
                }
            };
            pc.onicecandidate = (event) => {
                if (!event.candidate) return;
                void sendSignal('ice-candidate', {
                    senderId: userIdRef.current,
                    targetId: peerId,
                    candidate: event.candidate.toJSON(),
                });
            };
            pc.onconnectionstatechange = () => {
                const ex = peersRef.current.get(peerId);
                if (ex) {
                    ex.connectionState = pc.connectionState;
                    peersRef.current.set(peerId, { ...ex });
                    syncPeers();
                }
                const existingTimer = disconnectTimersRef.current.get(peerId);
                if (existingTimer && (pc.connectionState === 'connected' || pc.connectionState === 'connecting')) {
                    clearTimeout(existingTimer);
                    disconnectTimersRef.current.delete(peerId);
                }
                if (pc.connectionState === 'failed') {
                    pc.restartIce();
                    if (!disconnectTimersRef.current.has(peerId)) {
                        const t = setTimeout(() => {
                            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') removePC(peerId);
                        }, 20000);
                        disconnectTimersRef.current.set(peerId, t);
                    }
                } else if (pc.connectionState === 'disconnected') {
                    if (!disconnectTimersRef.current.has(peerId)) {
                        const t = setTimeout(() => {
                            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') removePC(peerId);
                        }, 20000);
                        disconnectTimersRef.current.set(peerId, t);
                    }
                } else if (pc.connectionState === 'closed') removePC(peerId);
            };
            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'failed') pc.restartIce();
            };
            peersRef.current.set(peerId, {
                connection: pc,
                remoteStream,
                userName: safeName,
                connectionState: pc.connectionState,
            });
            syncPeers();
            return pc;
        } catch (e) {
            console.error('createPC failed:', e);
            return null;
        }
    }

    function removePC(peerId: string) {
        const timer = disconnectTimersRef.current.get(peerId);
        if (timer) {
            clearTimeout(timer);
            disconnectTimersRef.current.delete(peerId);
        }
        pendingIceRef.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        const p = peersRef.current.get(peerId);
        if (p) {
            p.connection.close();
            peersRef.current.delete(peerId);
            syncPeers();
        }
        setPeerCameraSendingVideo((prev) => {
            if (!(peerId in prev)) return prev;
            const next = { ...prev };
            delete next[peerId];
            return next;
        });
    }

    async function sendOffer(pc: RTCPeerConnection, peerId: string) {
        makingOfferRef.current.add(peerId);
        try {
            await attachLocalTracksToPeer(pc, localStreamRef.current);
            await pc.setLocalDescription(await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }));
            const sdp = sdpJson(pc.localDescription);
            if (!sdp) return;
            await sendSignal('sdp-offer', {
                senderId: userIdRef.current,
                senderName: userNameRef.current,
                targetId: peerId,
                sdp,
            });
        } catch (err) {
            console.error('Offer error:', err);
        } finally {
            makingOfferRef.current.delete(peerId);
        }
    }

    async function acceptOffer(pc: RTCPeerConnection, peerId: string, sdp: RTCSessionDescriptionInit) {
        const polite = userIdRef.current > peerId;
        const offerCollision = makingOfferRef.current.has(peerId) || pc.signalingState !== 'stable';
        if (offerCollision && !polite) return;
        try {
            if (offerCollision && polite) {
                try {
                    await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
                } catch {
                    /* Safari and some browsers reject rollback; continue with remote offer. */
                }
            }
            await attachLocalTracksToPeer(pc, localStreamRef.current);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushIce(peerId, pc);
            if (pc.signalingState === 'have-remote-offer') {
                await attachLocalTracksToPeer(pc, localStreamRef.current);
                await pc.setLocalDescription(await pc.createAnswer());
                const answer = sdpJson(pc.localDescription);
                if (answer) {
                    await sendSignal('sdp-answer', {
                        senderId: userIdRef.current,
                        targetId: peerId,
                        sdp: answer,
                    });
                }
            }
        } catch (err) {
            console.error('Answer error:', err);
        }
    }

    // Main effect — only depends on stable values, NOT on callbacks
    useEffect(() => {
        if (!enabled || !roomId || !userId) return;
        let stopped = false;
        let channel: RealtimeChannel | null = null;

        const startTimer = window.setTimeout(() => {
            if (stopped) return;
            channel = supabase.channel(`room:${roomId}`, { config: { broadcast: { self: false } } });
            channelRef.current = channel;

            channel.on('broadcast', { event: 'peer-joined' }, (msg) => {
                const { senderId } = msg.payload as { senderId: string };
                if (!senderId || senderId === userIdRef.current) return;
                const snap = getCameraSendingSnapshotRef.current?.() ?? true;
                void sendSignal('participant-camera', { senderId: userIdRef.current, cameraOn: snap });
            });

            channel.on('broadcast', { event: 'participant-camera' }, (msg) => {
                const { senderId, cameraOn } = msg.payload as { senderId: string; cameraOn: boolean };
                if (!senderId || senderId === userIdRef.current) return;
                setPeerCameraSendingVideo((prev) => ({ ...prev, [senderId]: Boolean(cameraOn) }));
            });

            channel.on('broadcast', { event: 'peer-joined' }, (msg) => {
                const { senderId, senderName } = msg.payload as { senderId: string; senderName?: string };
                if (senderId === userIdRef.current || peersRef.current.has(senderId)) return;
                if (userIdRef.current > senderId) return;
                const pc = createPC(senderId, String(senderName ?? '').trim() || 'Participant');
                if (!pc) return;
                void sendOffer(pc, senderId);
            });

            channel.on('broadcast', { event: 'sdp-offer' }, (msg) => {
                const { senderId, senderName, targetId, sdp } = msg.payload as {
                    senderId: string;
                    senderName?: string;
                    targetId: string;
                    sdp: RTCSessionDescriptionInit;
                };
                if (targetId !== userIdRef.current || !sdp?.sdp) return;
                void (async () => {
                    let peer = peersRef.current.get(senderId);
                    if (!peer) {
                        const pc = createPC(senderId, String(senderName ?? '').trim() || 'Participant');
                        if (!pc) return;
                        peer = peersRef.current.get(senderId);
                    }
                    if (!peer) return;
                    await acceptOffer(peer.connection, senderId, sdp);
                })();
            });

            channel.on('broadcast', { event: 'sdp-answer' }, (msg) => {
                const { senderId, targetId, sdp } = msg.payload as {
                    senderId: string;
                    targetId: string;
                    sdp: RTCSessionDescriptionInit;
                };
                if (targetId !== userIdRef.current || !sdp?.sdp) return;
                const peer = peersRef.current.get(senderId);
                if (!peer) return;
                void (async () => {
                    try {
                        if (peer.connection.signalingState === 'have-local-offer') {
                            await peer.connection.setRemoteDescription(new RTCSessionDescription(sdp));
                            await flushIce(senderId, peer.connection);
                        }
                    } catch (err) {
                        console.error('SDP answer error:', err);
                    }
                })();
            });

            channel.on('broadcast', { event: 'ice-candidate' }, (msg) => {
                const { senderId, targetId, candidate } = msg.payload as {
                    senderId: string;
                    targetId: string;
                    candidate: RTCIceCandidateInit;
                };
                if (targetId !== userIdRef.current || !candidate) return;
                const peer = peersRef.current.get(senderId);
                if (!peer) {
                    queueIce(senderId, candidate);
                    return;
                }
                void (async () => {
                    try {
                        if (peer.connection.remoteDescription) {
                            await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
                        } else {
                            queueIce(senderId, candidate);
                        }
                    } catch (err) {
                        console.error('ICE error:', err);
                    }
                })();
            });

            channel.on('broadcast', { event: 'peer-left' }, (msg) => {
                removePC((msg.payload as { senderId: string }).senderId);
            });
            channel.on('broadcast', { event: 'chat-message' }, (msg) => { setChatMessages((prev) => [...prev, msg.payload as ChatMessage]); });
            channel.on('broadcast', { event: 'room-control' }, (msg) => {
                onRoomControlRef.current?.(msg.payload as RoomControlPayload);
            });
            channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
                const left = Array.isArray(leftPresences) ? leftPresences : [];
                left.forEach((p) => {
                    const uid = (p as { userId?: string } | null | undefined)?.userId;
                    if (uid && uid !== userIdRef.current) removePC(uid);
                });
            });
            channel.on('presence', { event: 'sync' }, () => {
                const state = channel!.presenceState();
                const list: RoomParticipant[] = [];
                for (const key of Object.keys(state)) {
                    for (const p of metasFromPresenceValue(state[key])) {
                        const uid = typeof p.userId === 'string' ? p.userId : '';
                        if (!uid) continue;
                        list.push({
                            userId: uid,
                            userName: String(p.userName ?? '').trim() || 'Participant',
                            userRole: (p.userRole as string | null | undefined) || null,
                            joinedAt: typeof p.online_at === 'string' ? p.online_at : String(p.online_at ?? ''),
                        });
                    }
                }
                setParticipants(list);

                list.forEach((p) => {
                    const otherId = p.userId;
                    if (!otherId || otherId === userIdRef.current) return;
                    if (peersRef.current.has(otherId)) return;
                    if (userIdRef.current > otherId) return;

                    const pc = createPC(otherId, p.userName || 'Participant');
                    if (!pc) return;
                    void sendOffer(pc, otherId);
                });
            });

            channel.subscribe(async (status) => {
                if (stopped || status !== 'SUBSCRIBED') return;
                let waited = 0;
                while (!localStreamRef.current && waited < 1500) {
                    await new Promise((r) => setTimeout(r, 100));
                    waited += 100;
                    if (stopped) return;
                }
                const trackName = String(userNameRef.current ?? '').trim() || 'Participant';
                await channel!.track({
                    userId: userIdRef.current,
                    userName: trackName,
                    userRole: userRole || null,
                    online_at: new Date().toISOString(),
                });
                await new Promise((r) => setTimeout(r, 400));
                if (stopped) return;
                await sendSignal('peer-joined', { senderId: userIdRef.current, senderName: trackName });
                const snap = getCameraSendingSnapshotRef.current?.() ?? true;
                await sendSignal('participant-camera', { senderId: userIdRef.current, cameraOn: snap });
            });
        }, 80);

        return () => {
            stopped = true;
            clearTimeout(startTimer);
            try {
                channel?.send({ type: 'broadcast', event: 'peer-left', payload: { senderId: userIdRef.current } });
            } catch (e) {
                console.warn('peer-left broadcast on teardown failed', e);
            }
            peersRef.current.forEach((p) => p.connection.close());
            peersRef.current.clear();
            disconnectTimersRef.current.forEach((t) => clearTimeout(t));
            disconnectTimersRef.current.clear();
            pendingIceRef.current.clear();
            makingOfferRef.current.clear();
            syncPeers();
            if (channel) {
                channel.untrack();
                supabase.removeChannel(channel);
            }
            if (channelRef.current === channel) channelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, roomId, userId]);

    // Update tracks in existing connections when localStream changes
    useEffect(() => {
        peersRef.current.forEach((peer) => {
            void attachLocalTracksToPeer(peer.connection, localStream).catch(console.error);
        });
    }, [localStream]);

    const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
        await Promise.all(
            Array.from(peersRef.current.values()).map((peer) =>
                replaceKindTrack(peer.connection, 'video', newTrack),
            ),
        );
    }, []);

    const replaceAudioTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
        await Promise.all(
            Array.from(peersRef.current.values()).map((peer) =>
                replaceKindTrack(peer.connection, 'audio', newTrack),
            ),
        );
    }, []);

    const sendChatMessage = useCallback((payload: SendChatPayload) => {
        if (!channelRef.current) return;
        const text = typeof payload === 'string' ? payload.trim() : (payload.message ?? '').trim();
        const attachmentUrl = typeof payload === 'string' ? undefined : payload.attachmentUrl;
        const attachmentKind = typeof payload === 'string' ? undefined : payload.attachmentKind;
        const fileName = typeof payload === 'string' ? undefined : payload.fileName;
        if (!text && !attachmentUrl) return;
        const chatMsg: ChatMessage = {
            id: `${userIdRef.current}-${Date.now()}`,
            senderId: userIdRef.current,
            senderName: userNameRef.current,
            message: text,
            timestamp: new Date().toISOString(),
            attachmentUrl: attachmentUrl ?? null,
            attachmentKind: attachmentKind ?? null,
            fileName: fileName ?? null,
        };
        channelRef.current.send({ type: 'broadcast', event: 'chat-message', payload: chatMsg });
        setChatMessages((prev) => [...prev, chatMsg]);
    }, []);

    const sendRoomControl = useCallback((action: RoomControlAction, targetUserId?: string, opts?: SendRoomControlOptions) => {
        if (!channelRef.current) return;
        const payload: RoomControlPayload = {
            action,
            senderId: userIdRef.current,
            senderName: userNameRef.current,
            timestamp: new Date().toISOString(),
        };
        if (targetUserId) payload.targetUserId = targetUserId;
        if (opts?.mutePolicy) payload.mutePolicy = opts.mutePolicy;
        channelRef.current.send({
            type: 'broadcast',
            event: 'room-control',
            payload,
        });
    }, []);

    const sendCameraState = useCallback((cameraOn: boolean) => {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'participant-camera',
            payload: { senderId: userIdRef.current, cameraOn },
        });
    }, []);

    return {
        peers,
        participants,
        channelRef,
        chatMessages,
        sendChatMessage,
        replaceVideoTrack,
        replaceAudioTrack,
        sendRoomControl,
        sendCameraState,
        peerCameraSendingVideo,
    };
}
