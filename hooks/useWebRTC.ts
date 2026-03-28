'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
};

export interface PeerState { connection: RTCPeerConnection; remoteStream: MediaStream | null; userName: string; }
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

    // These are NOT useCallbacks — they use refs so they never go stale
    function createPC(peerId: string, peerName: string): RTCPeerConnection | null {
        try {
            if (typeof RTCPeerConnection === 'undefined') {
                console.warn('RTCPeerConnection is not available (requires a secure context and a supported browser).');
                return null;
            }
            const safeName = String(peerName ?? '').trim() || 'Participant';
            const pc = new RTCPeerConnection(ICE_SERVERS);
            // Add local tracks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => { pc.addTrack(track, localStreamRef.current!); });
            }
            const remoteStream = new MediaStream();
            let negotiationBusy = false;
            pc.onnegotiationneeded = async () => {
            // Initial SDP is driven by the peer-joined handler; this handles late tracks / transceiver changes only.
            if (!pc.localDescription || !pc.remoteDescription) return;
            if (negotiationBusy || pc.signalingState !== 'stable') return;
            const ch = channelRef.current;
            if (!ch) return;
            negotiationBusy = true;
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                ch.send({
                    type: 'broadcast',
                    event: 'sdp-offer',
                    payload: { senderId: userIdRef.current, senderName: userNameRef.current, targetId: peerId, sdp: pc.localDescription },
                });
            } catch (e) {
                console.error('Renegotiation offer error:', e);
            } finally {
                negotiationBusy = false;
            }
            };
            pc.ontrack = (event) => {
                if (event.streams[0]) {
                    event.streams[0].getTracks().forEach(t => { if (!remoteStream.getTracks().find(rt => rt.id === t.id)) remoteStream.addTrack(t); });
                } else if (event.track) {
                    if (!remoteStream.getTracks().find(t => t.id === event.track.id)) remoteStream.addTrack(event.track);
                }
                const ex = peersRef.current.get(peerId);
                if (ex) { ex.remoteStream = remoteStream; peersRef.current.set(peerId, { ...ex }); syncPeers(); }
            };
            pc.onicecandidate = (event) => {
                if (event.candidate && channelRef.current) {
                    channelRef.current.send({ type: 'broadcast', event: 'ice-candidate', payload: { senderId: userIdRef.current, targetId: peerId, candidate: event.candidate.toJSON() } });
                }
            };
            pc.onconnectionstatechange = () => {
                console.log(`Peer ${peerId}: ${pc.connectionState}`);
                if (pc.connectionState === 'failed') pc.restartIce();
                else if (pc.connectionState === 'disconnected') setTimeout(() => { if (pc.connectionState !== 'connected') removePC(peerId); }, 5000);
                else if (pc.connectionState === 'closed') removePC(peerId);
            };
            pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'failed') pc.restartIce(); };
            peersRef.current.set(peerId, { connection: pc, remoteStream, userName: safeName });
            syncPeers();
            return pc;
        } catch (e) {
            console.error('createPC failed:', e);
            return null;
        }
    }

    function removePC(peerId: string) {
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

    // Main effect — only depends on stable values, NOT on callbacks
    useEffect(() => {
        if (!enabled || !roomId || !userId) return;
        const channel = supabase.channel(`room:${roomId}`, { config: { broadcast: { self: false } } });
        channelRef.current = channel;

        // When anyone joins, tell them (and others) our camera/screen state — remote track.muted is unreliable for camera-off.
        channel.on('broadcast', { event: 'peer-joined' }, (msg) => {
            const { senderId } = msg.payload as { senderId: string };
            if (!senderId || senderId === userIdRef.current) return;
            const snap = getCameraSendingSnapshotRef.current?.() ?? true;
            channel.send({
                type: 'broadcast',
                event: 'participant-camera',
                payload: { senderId: userIdRef.current, cameraOn: snap },
            });
        });

        channel.on('broadcast', { event: 'participant-camera' }, (msg) => {
            const { senderId, cameraOn } = msg.payload as { senderId: string; cameraOn: boolean };
            if (!senderId || senderId === userIdRef.current) return;
            setPeerCameraSendingVideo((prev) => ({ ...prev, [senderId]: Boolean(cameraOn) }));
        });

        channel.on('broadcast', { event: 'peer-joined' }, async (msg) => {
            const { senderId, senderName } = msg.payload as { senderId: string; senderName?: string };
            if (senderId === userIdRef.current || peersRef.current.has(senderId)) return;
            // Glare avoidance: only the lexicographically smaller userId sends the initial offer.
            if (userIdRef.current > senderId) return;
            const pc = createPC(senderId, String(senderName ?? '').trim() || 'Participant');
            if (!pc) return;
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel.send({ type: 'broadcast', event: 'sdp-offer', payload: { senderId: userIdRef.current, senderName: userNameRef.current, targetId: senderId, sdp: pc.localDescription } });
            } catch (err) { console.error('Offer error:', err); }
        });

        channel.on('broadcast', { event: 'sdp-offer' }, async (msg) => {
            const { senderId, senderName, targetId, sdp } = msg.payload as { senderId: string; senderName?: string; targetId: string; sdp: RTCSessionDescriptionInit };
            if (targetId !== userIdRef.current) return;
            const existing = peersRef.current.get(senderId);
            if (existing) {
                const conn = existing.connection;
                try {
                    await conn.setRemoteDescription(new RTCSessionDescription(sdp));
                    if (conn.signalingState === 'have-remote-offer') {
                        const answer = await conn.createAnswer();
                        await conn.setLocalDescription(answer);
                        channel.send({ type: 'broadcast', event: 'sdp-answer', payload: { senderId: userIdRef.current, targetId: senderId, sdp: conn.localDescription } });
                    }
                } catch (err) {
                    console.error('Renegotiation answer error:', err);
                }
                return;
            }
            const pc = createPC(senderId, String(senderName ?? '').trim() || 'Participant');
            if (!pc) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                channel.send({ type: 'broadcast', event: 'sdp-answer', payload: { senderId: userIdRef.current, targetId: senderId, sdp: pc.localDescription } });
            } catch (err) { console.error('Answer error:', err); }
        });

        channel.on('broadcast', { event: 'sdp-answer' }, async (msg) => {
            const { senderId, targetId, sdp } = msg.payload as { senderId: string; targetId: string; sdp: RTCSessionDescriptionInit };
            if (targetId !== userIdRef.current) return;
            const peer = peersRef.current.get(senderId);
            if (peer) { try { await peer.connection.setRemoteDescription(new RTCSessionDescription(sdp)); } catch (err) { console.error('SDP answer error:', err); } }
        });

        channel.on('broadcast', { event: 'ice-candidate' }, async (msg) => {
            const { senderId, targetId, candidate } = msg.payload as { senderId: string; targetId: string; candidate: RTCIceCandidateInit };
            if (targetId !== userIdRef.current) return;
            const peer = peersRef.current.get(senderId);
            if (!peer) return;
            try {
                if (peer.connection.remoteDescription) { await peer.connection.addIceCandidate(new RTCIceCandidate(candidate)); }
                else {
                    const retry = async (n: number) => { if (n <= 0) return; await new Promise(r => setTimeout(r, 200)); const p = peersRef.current.get(senderId); if (p?.connection.remoteDescription) await p.connection.addIceCandidate(new RTCIceCandidate(candidate)); else await retry(n - 1); };
                    retry(15).catch(console.error);
                }
            } catch (err) { console.error('ICE error:', err); }
        });

        channel.on('broadcast', { event: 'peer-left' }, (msg) => {
            removePC((msg.payload as { senderId: string }).senderId);
        });
        channel.on('broadcast', { event: 'chat-message' }, (msg) => { setChatMessages(prev => [...prev, msg.payload as ChatMessage]); });
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
            const state = channel.presenceState();
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

            // Self-heal race: if presence knows someone is here but no RTCPeerConnection exists,
            // start initial SDP from the lexicographically smaller userId.
            list.forEach((p) => {
                const otherId = p.userId;
                if (!otherId || otherId === userIdRef.current) return;
                if (peersRef.current.has(otherId)) return;
                if (userIdRef.current > otherId) return;

                const pc = createPC(otherId, p.userName || 'Participant');
                if (!pc) return;
                void (async () => {
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        channel.send({
                            type: 'broadcast',
                            event: 'sdp-offer',
                            payload: {
                                senderId: userIdRef.current,
                                senderName: userNameRef.current,
                                targetId: otherId,
                                sdp: pc.localDescription,
                            },
                        });
                    } catch (err) {
                        console.error('Presence sync offer error:', err);
                    }
                })();
            });
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const trackName = String(userName ?? '').trim() || 'Participant';
                await channel.track({ userId, userName: trackName, userRole: userRole || null, online_at: new Date().toISOString() });
                await new Promise(r => setTimeout(r, 500));
                channel.send({ type: 'broadcast', event: 'peer-joined', payload: { senderId: userId, senderName: trackName } });
                const snap = getCameraSendingSnapshotRef.current?.() ?? true;
                channel.send({
                    type: 'broadcast',
                    event: 'participant-camera',
                    payload: { senderId: userId, cameraOn: snap },
                });
            }
        });

        return () => {
            try {
                channel.send({ type: 'broadcast', event: 'peer-left', payload: { senderId: userIdRef.current } });
            } catch (e) {
                console.warn('peer-left broadcast on teardown failed', e);
            }
            peersRef.current.forEach(p => p.connection.close());
            peersRef.current.clear();
            syncPeers();
            channel.untrack();
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, roomId, userId]);

    // Update tracks in existing connections when localStream changes
    useEffect(() => {
        if (!localStream) return;
        peersRef.current.forEach(peer => {
            const senders = peer.connection.getSenders();
            localStream.getTracks().forEach(track => {
                const sender = senders.find(s => s.track?.kind === track.kind);
                if (sender) sender.replaceTrack(track).catch(console.error);
                else peer.connection.addTrack(track, localStream);
            });
        });
    }, [localStream]);

    const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack) => {
        const promises: Promise<void>[] = [];
        peersRef.current.forEach(peer => { const s = peer.connection.getSenders().find(s => s.track?.kind === 'video'); if (s) promises.push(s.replaceTrack(newTrack)); });
        await Promise.all(promises);
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
        setChatMessages(prev => [...prev, chatMsg]);
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
        sendRoomControl,
        sendCameraState,
        peerCameraSendingVideo,
    };
}
