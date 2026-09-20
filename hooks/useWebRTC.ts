'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { hasUsableRelay, normalizeIceServers, parseStaticTurn, STUN_SERVERS } from '@/lib/ice-servers';

function fallbackIceServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [...(STUN_SERVERS as RTCIceServer[])];
    const staticTurn = parseStaticTurn({
        urls: process.env.NEXT_PUBLIC_TURN_URLS,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
    if (staticTurn) servers.push(staticTurn as RTCIceServer);
    return servers;
}

let iceServersPromise: Promise<RTCIceServer[]> | null = null;

function loadIceServers(): Promise<RTCIceServer[]> {
    if (!iceServersPromise) {
        iceServersPromise = fetch('/api/webrtc/ice', { cache: 'no-store' })
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
                const servers = normalizeIceServers(body) as RTCIceServer[];
                return servers.length ? servers : fallbackIceServers();
            })
            .catch(() => fallbackIceServers());
    }
    return iceServersPromise;
}

function iceConfig(iceServers: RTCIceServer[]): RTCConfiguration {
    return {
        iceServers,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 0,
    };
}

const peerTransceivers = new WeakMap<
    RTCPeerConnection,
    { audio: RTCRtpTransceiver; video: RTCRtpTransceiver }
>();

function transceiverForKind(pc: RTCPeerConnection, kind: 'audio' | 'video') {
    const pinned = peerTransceivers.get(pc);
    if (pinned) return kind === 'audio' ? pinned.audio : pinned.video;
    return pc.getTransceivers().find((t) => t.receiver.track?.kind === kind || t.sender.track?.kind === kind);
}

async function setKindTrack(pc: RTCPeerConnection, kind: 'audio' | 'video', track: MediaStreamTrack | null) {
    const transceiver = transceiverForKind(pc, kind);
    if (!transceiver) {
        if (track) pc.addTrack(track, new MediaStream([track]));
        return;
    }
    if (transceiver.direction !== 'sendrecv') transceiver.direction = 'sendrecv';
    if (transceiver.sender.track === track) return;
    try {
        await transceiver.sender.replaceTrack(track);
    } catch (err) {
        console.error(`replaceTrack(${kind}) failed`, err);
    }
}

async function attachLocalTracksToPeer(pc: RTCPeerConnection, local: MediaStream | null) {
    if (!local) return;
    const audio = local.getAudioTracks().find((t) => t.readyState === 'live') ?? null;
    const video = local.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    await setKindTrack(pc, 'audio', audio);
    await setKindTrack(pc, 'video', video);
}

function sdpJson(desc: RTCSessionDescription | RTCSessionDescriptionInit | null | undefined) {
    if (!desc?.type || !desc.sdp) return null;
    return { type: desc.type, sdp: desc.sdp };
}

/** Peer ids are `<userId>#<session>` so one account on two devices still pairs. */
export function userIdFromPeerId(peerId: string) {
    const cut = peerId.indexOf('#');
    return cut === -1 ? peerId : peerId.slice(0, cut);
}

function newPeerId(userId: string) {
    return `${userId}#${Math.random().toString(36).slice(2, 10)}`;
}

/** Lower peer id is impolite and wins offer glare. */
export function shouldInitiateOffer(selfPeerId: string, otherPeerId: string) {
    if (!selfPeerId || !otherPeerId) return false;
    return selfPeerId < otherPeerId;
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
export interface RoomParticipant { peerId: string; userId: string; userName: string; userRole?: string | null; joinedAt: string; }
export type RoomControlAction = 'mute-all' | 'allow-unmute' | 'allow-unmute-peer' | 'kick-peer';
export type MuteAllPolicy = 'creator' | 'ec_faculty';
export interface RoomControlPayload {
    action: RoomControlAction;
    senderId: string;
    senderName: string;
    timestamp: string;
    targetUserId?: string;
    mutePolicy?: MuteAllPolicy;
}

export interface SendRoomControlOptions {
    mutePolicy?: MuteAllPolicy;
}

interface UseWebRTCOptions {
    supabase: SupabaseClient; roomId: string; userId: string; userName: string;
    userRole?: string | null; localStream: MediaStream | null; enabled: boolean;
    onRoomControl?: (payload: RoomControlPayload) => void;
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
    const [peerCameraSendingVideo, setPeerCameraSendingVideo] = useState<Record<string, boolean>>({});
    const peersRef = useRef<Map<string, PeerState>>(new Map());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const iceServersRef = useRef<RTCIceServer[]>(fallbackIceServers());
    const iceReadyRef = useRef(false);
    const [relayAvailable, setRelayAvailable] = useState<boolean | null>(null);
    const selfPeerIdRef = useRef('');
    if (userId && !selfPeerIdRef.current.startsWith(`${userId}#`)) {
        selfPeerIdRef.current = newPeerId(userId);
    }
    const userIdRef = useRef(userId);
    const userNameRef = useRef(userName);
    const onRoomControlRef = useRef(onRoomControl);
    const getCameraSendingSnapshotRef = useRef(getCameraSendingSnapshot);
    const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const makingOfferRef = useRef<Set<string>>(new Set());
    const ignoreOfferRef = useRef<Set<string>>(new Set());
    const pendingPeersRef = useRef<Map<string, string>>(new Map());

    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { userNameRef.current = userName; }, [userName]);
    useEffect(() => { onRoomControlRef.current = onRoomControl; }, [onRoomControl]);
    useEffect(() => {
        getCameraSendingSnapshotRef.current = getCameraSendingSnapshot;
    }, [getCameraSendingSnapshot]);

    const syncPeers = useCallback(() => { setPeers(new Map(peersRef.current)); }, []);

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

    function removePC(peerId: string) {
        const timer = disconnectTimersRef.current.get(peerId);
        if (timer) {
            clearTimeout(timer);
            disconnectTimersRef.current.delete(peerId);
        }
        pendingIceRef.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        ignoreOfferRef.current.delete(peerId);
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

    function createPC(peerId: string, peerName: string): RTCPeerConnection | null {
        try {
            if (typeof RTCPeerConnection === 'undefined') {
                console.warn('RTCPeerConnection is not available (requires a secure context and a supported browser).');
                return null;
            }
            const existing = peersRef.current.get(peerId);
            if (existing) return existing.connection;

            const safeName = String(peerName ?? '').trim() || 'Participant';
            const pc = new RTCPeerConnection(iceConfig(iceServersRef.current));
            const remoteStream = new MediaStream();

            pc.onnegotiationneeded = async () => {
                if (pc.signalingState !== 'stable') return;
                if (!shouldInitiateOffer(selfPeerIdRef.current, peerId)) return;
                makingOfferRef.current.add(peerId);
                try {
                    await attachLocalTracksToPeer(pc, localStreamRef.current);
                    await pc.setLocalDescription(await pc.createOffer());
                    const sdp = sdpJson(pc.localDescription);
                    if (sdp) {
                        await sendSignal('sdp-offer', {
                            senderId: selfPeerIdRef.current,
                            senderName: userNameRef.current,
                            targetId: peerId,
                            sdp,
                        });
                    }
                } catch (e) {
                    console.error('negotiationneeded error:', e);
                } finally {
                    makingOfferRef.current.delete(peerId);
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
                    track.onended = () => {
                        try { remoteStream.removeTrack(track); } catch { /* ignore */ }
                        syncPeers();
                    };
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
                    senderId: selfPeerIdRef.current,
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
                    try { pc.restartIce(); } catch { /* ignore */ }
                    if (!disconnectTimersRef.current.has(peerId)) {
                        const t = setTimeout(() => {
                            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') removePC(peerId);
                        }, 45000);
                        disconnectTimersRef.current.set(peerId, t);
                    }
                } else if (pc.connectionState === 'disconnected') {
                    if (!disconnectTimersRef.current.has(peerId)) {
                        const t = setTimeout(() => {
                            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') removePC(peerId);
                        }, 45000);
                        disconnectTimersRef.current.set(peerId, t);
                    }
                } else if (pc.connectionState === 'closed') removePC(peerId);
            };
            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'failed') {
                    try { pc.restartIce(); } catch { /* ignore */ }
                }
            };

            const audioTr = pc.addTransceiver('audio', { direction: 'sendrecv' });
            const videoTr = pc.addTransceiver('video', { direction: 'sendrecv' });
            peerTransceivers.set(pc, { audio: audioTr, video: videoTr });
            void attachLocalTracksToPeer(pc, localStreamRef.current);

            if (shouldInitiateOffer(selfPeerIdRef.current, peerId)) {
                window.setTimeout(() => {
                    const peer = peersRef.current.get(peerId);
                    if (!peer || peer.connection !== pc) return;
                    if (pc.signalingState !== 'stable' || pc.remoteDescription) return;
                    if (makingOfferRef.current.has(peerId)) return;
                    makingOfferRef.current.add(peerId);
                    void (async () => {
                        try {
                            await attachLocalTracksToPeer(pc, localStreamRef.current);
                            await pc.setLocalDescription(await pc.createOffer());
                            const sdp = sdpJson(pc.localDescription);
                            if (sdp) {
                                await sendSignal('sdp-offer', {
                                    senderId: selfPeerIdRef.current,
                                    senderName: userNameRef.current,
                                    targetId: peerId,
                                    sdp,
                                });
                            }
                        } catch (e) {
                            console.error('backup offer error:', e);
                        } finally {
                            makingOfferRef.current.delete(peerId);
                        }
                    })();
                }, 1200);
            }

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

    function ensurePeer(peerId: string, peerName: string) {
        if (!peerId || peerId === selfPeerIdRef.current) return;
        if (!iceReadyRef.current) {
            pendingPeersRef.current.set(peerId, peerName);
            return;
        }
        if (peersRef.current.has(peerId)) return;
        createPC(peerId, peerName);
    }

    async function acceptOffer(pc: RTCPeerConnection, peerId: string, sdp: RTCSessionDescriptionInit) {
        const polite = !shouldInitiateOffer(selfPeerIdRef.current, peerId);
        const offerCollision = makingOfferRef.current.has(peerId) || pc.signalingState !== 'stable';
        const ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) {
            ignoreOfferRef.current.add(peerId);
            return;
        }
        ignoreOfferRef.current.delete(peerId);
        try {
            if (offerCollision) {
                try {
                    await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
                } catch {
                    /* Safari may reject rollback */
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
                        senderId: selfPeerIdRef.current,
                        targetId: peerId,
                        sdp: answer,
                    });
                }
            }
        } catch (err) {
            console.error('Answer error:', err);
        }
    }

    useEffect(() => {
        if (!enabled || !roomId || !userId) return;
        let stopped = false;
        let channel: RealtimeChannel | null = null;
        iceReadyRef.current = false;
        pendingPeersRef.current.clear();

        const start = async () => {
            const servers = await loadIceServers();
            if (stopped) return;
            iceServersRef.current = servers;
            iceReadyRef.current = true;
            setRelayAvailable(hasUsableRelay(servers));

            channel = supabase.channel(`room:${roomId}`, {
                config: {
                    broadcast: { self: false },
                    presence: { key: selfPeerIdRef.current },
                },
            });
            channelRef.current = channel;

            channel.on('broadcast', { event: 'peer-joined' }, (msg) => {
                const { senderId, senderName } = msg.payload as { senderId: string; senderName?: string };
                if (!senderId || senderId === selfPeerIdRef.current) return;
                ensurePeer(senderId, String(senderName ?? '').trim() || 'Participant');
                const snap = getCameraSendingSnapshotRef.current?.() ?? true;
                void sendSignal('participant-camera', { senderId: selfPeerIdRef.current, cameraOn: snap });
            });

            channel.on('broadcast', { event: 'participant-camera' }, (msg) => {
                const { senderId, cameraOn } = msg.payload as { senderId: string; cameraOn: boolean };
                if (!senderId || senderId === selfPeerIdRef.current) return;
                setPeerCameraSendingVideo((prev) => ({ ...prev, [senderId]: Boolean(cameraOn) }));
            });

            channel.on('broadcast', { event: 'sdp-offer' }, (msg) => {
                const { senderId, senderName, targetId, sdp } = msg.payload as {
                    senderId: string;
                    senderName?: string;
                    targetId: string;
                    sdp: RTCSessionDescriptionInit;
                };
                if (targetId !== selfPeerIdRef.current || !sdp?.sdp) return;
                void (async () => {
                    ensurePeer(senderId, String(senderName ?? '').trim() || 'Participant');
                    const peer = peersRef.current.get(senderId);
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
                if (targetId !== selfPeerIdRef.current || !sdp?.sdp) return;
                const peer = peersRef.current.get(senderId);
                if (!peer) return;
                if (ignoreOfferRef.current.has(senderId)) return;
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
                if (targetId !== selfPeerIdRef.current || !candidate) return;
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
            channel.on('broadcast', { event: 'chat-message' }, (msg) => {
                setChatMessages((prev) => [...prev, msg.payload as ChatMessage]);
            });
            channel.on('broadcast', { event: 'room-control' }, (msg) => {
                onRoomControlRef.current?.(msg.payload as RoomControlPayload);
            });
            channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
                const left = Array.isArray(leftPresences) ? leftPresences : [];
                left.forEach((p) => {
                    const meta = p as { peerId?: string; userId?: string } | null | undefined;
                    const pid = meta?.peerId || meta?.userId;
                    if (pid && pid !== selfPeerIdRef.current) removePC(pid);
                });
            });
            channel.on('presence', { event: 'sync' }, () => {
                const state = channel!.presenceState();
                const list: RoomParticipant[] = [];
                for (const key of Object.keys(state)) {
                    for (const p of metasFromPresenceValue(state[key])) {
                        const uid = typeof p.userId === 'string' ? p.userId : '';
                        if (!uid) continue;
                        const peerId = typeof p.peerId === 'string' && p.peerId ? p.peerId : uid;
                        list.push({
                            peerId,
                            userId: uid,
                            userName: String(p.userName ?? '').trim() || 'Participant',
                            userRole: (p.userRole as string | null | undefined) || null,
                            joinedAt: typeof p.online_at === 'string' ? p.online_at : String(p.online_at ?? ''),
                        });
                        ensurePeer(peerId, String(p.userName ?? '').trim() || 'Participant');
                    }
                }
                setParticipants(list);
            });

            channel.subscribe(async (status) => {
                if (stopped || status !== 'SUBSCRIBED') return;
                let waited = 0;
                while (!localStreamRef.current && waited < 2000) {
                    await new Promise((r) => setTimeout(r, 100));
                    waited += 100;
                    if (stopped) return;
                }
                pendingPeersRef.current.forEach((name, id) => ensurePeer(id, name));
                pendingPeersRef.current.clear();
                const trackName = String(userNameRef.current ?? '').trim() || 'Participant';
                await channel!.track({
                    peerId: selfPeerIdRef.current,
                    userId: userIdRef.current,
                    userName: trackName,
                    userRole: userRole || null,
                    online_at: new Date().toISOString(),
                });
                if (stopped) return;
                await sendSignal('peer-joined', { senderId: selfPeerIdRef.current, senderName: trackName });
                const snap = getCameraSendingSnapshotRef.current?.() ?? true;
                await sendSignal('participant-camera', { senderId: selfPeerIdRef.current, cameraOn: snap });
            });
        };

        void start();

        return () => {
            stopped = true;
            try {
                channel?.send({ type: 'broadcast', event: 'peer-left', payload: { senderId: selfPeerIdRef.current } });
            } catch (e) {
                console.warn('peer-left broadcast on teardown failed', e);
            }
            peersRef.current.forEach((p) => p.connection.close());
            peersRef.current.clear();
            disconnectTimersRef.current.forEach((t) => clearTimeout(t));
            disconnectTimersRef.current.clear();
            pendingIceRef.current.clear();
            makingOfferRef.current.clear();
            ignoreOfferRef.current.clear();
            pendingPeersRef.current.clear();
            iceReadyRef.current = false;
            syncPeers();
            if (channel) {
                channel.untrack();
                supabase.removeChannel(channel);
            }
            if (channelRef.current === channel) channelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, roomId, userId]);

    useEffect(() => {
        peersRef.current.forEach((peer) => {
            void attachLocalTracksToPeer(peer.connection, localStream).catch(console.error);
        });
    }, [localStream]);

    const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
        await Promise.all(
            Array.from(peersRef.current.values()).map((peer) =>
                setKindTrack(peer.connection, 'video', newTrack),
            ),
        );
    }, []);

    const replaceAudioTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
        await Promise.all(
            Array.from(peersRef.current.values()).map((peer) =>
                setKindTrack(peer.connection, 'audio', newTrack),
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
            payload: { senderId: selfPeerIdRef.current, cameraOn },
        });
    }, []);

    return {
        selfPeerId: selfPeerIdRef.current,
        relayAvailable,
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
