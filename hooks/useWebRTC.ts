'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export interface PeerState {
    connection: RTCPeerConnection;
    remoteStream: MediaStream | null;
    userName: string;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    message: string;
    timestamp: string;
}

export interface RoomParticipant {
    userId: string;
    userName: string;
    joinedAt: string;
}

interface UseWebRTCOptions {
    supabase: SupabaseClient;
    roomId: string;
    userId: string;
    userName: string;
    localStream: MediaStream | null;
    enabled: boolean; // only start when meeting is loaded and user is authenticated
}

export function useWebRTC({
    supabase,
    roomId,
    userId,
    userName,
    localStream,
    enabled,
}: UseWebRTCOptions) {
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<RoomParticipant[]>([]);
    const peersRef = useRef<Map<string, PeerState>>(new Map());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // Keep localStreamRef in sync
    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    // Sync peersRef → state
    const syncPeers = useCallback(() => {
        setPeers(new Map(peersRef.current));
    }, []);

    // Create a new RTCPeerConnection for a remote peer
    const createPeerConnection = useCallback(
        (peerId: string, peerName: string): RTCPeerConnection => {
            const pc = new RTCPeerConnection(ICE_SERVERS);

            // Add local tracks to the connection
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            }

            // Handle incoming remote tracks
            const remoteStream = new MediaStream();
            pc.ontrack = (event) => {
                event.streams[0]?.getTracks().forEach((track) => {
                    remoteStream.addTrack(track);
                });
                const existing = peersRef.current.get(peerId);
                if (existing) {
                    existing.remoteStream = remoteStream;
                    peersRef.current.set(peerId, { ...existing });
                    syncPeers();
                }
            };

            // Send ICE candidates to the remote peer via Realtime broadcast
            pc.onicecandidate = (event) => {
                if (event.candidate && channelRef.current) {
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'ice-candidate',
                        payload: {
                            senderId: userId,
                            targetId: peerId,
                            candidate: event.candidate.toJSON(),
                        },
                    });
                }
            };

            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    removePeer(peerId);
                }
            };

            // Store the peer
            peersRef.current.set(peerId, {
                connection: pc,
                remoteStream,
                userName: peerName,
            });
            syncPeers();

            return pc;
        },
        [userId, syncPeers],
    );

    // Remove a peer and close its connection
    const removePeer = useCallback(
        (peerId: string) => {
            const peer = peersRef.current.get(peerId);
            if (peer) {
                peer.connection.close();
                peersRef.current.delete(peerId);
                syncPeers();
            }
        },
        [syncPeers],
    );

    // Main effect: subscribe to Realtime channel and handle signaling
    useEffect(() => {
        if (!enabled || !roomId || !userId) return;

        const channel = supabase.channel(`room:${roomId}`, {
            config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        // --- Signaling event handlers ---

        // When a new peer joins, create a connection and send an SDP offer
        channel.on('broadcast', { event: 'peer-joined' }, async (msg) => {
            const { senderId, senderName } = msg.payload as {
                senderId: string;
                senderName: string;
            };
            if (senderId === userId) return;
            // Don't create duplicate connections
            if (peersRef.current.has(senderId)) return;

            const pc = createPeerConnection(senderId, senderName);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel.send({
                    type: 'broadcast',
                    event: 'sdp-offer',
                    payload: {
                        senderId: userId,
                        senderName: userName,
                        targetId: senderId,
                        sdp: pc.localDescription,
                    },
                });
            } catch (err) {
                console.error('Error creating SDP offer:', err);
            }
        });

        // When receiving an SDP offer, create a connection and send an answer
        channel.on('broadcast', { event: 'sdp-offer' }, async (msg) => {
            const { senderId, senderName, targetId, sdp } = msg.payload as {
                senderId: string;
                senderName: string;
                targetId: string;
                sdp: RTCSessionDescriptionInit;
            };
            if (targetId !== userId) return;

            // Close existing connection if any (renegotiation)
            if (peersRef.current.has(senderId)) {
                peersRef.current.get(senderId)!.connection.close();
                peersRef.current.delete(senderId);
            }

            const pc = createPeerConnection(senderId, senderName);
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                channel.send({
                    type: 'broadcast',
                    event: 'sdp-answer',
                    payload: {
                        senderId: userId,
                        targetId: senderId,
                        sdp: pc.localDescription,
                    },
                });
            } catch (err) {
                console.error('Error handling SDP offer:', err);
            }
        });

        // When receiving an SDP answer, set the remote description
        channel.on('broadcast', { event: 'sdp-answer' }, async (msg) => {
            const { senderId, targetId, sdp } = msg.payload as {
                senderId: string;
                targetId: string;
                sdp: RTCSessionDescriptionInit;
            };
            if (targetId !== userId) return;

            const peer = peersRef.current.get(senderId);
            if (peer) {
                try {
                    await peer.connection.setRemoteDescription(
                        new RTCSessionDescription(sdp),
                    );
                } catch (err) {
                    console.error('Error setting remote description:', err);
                }
            }
        });

        // When receiving an ICE candidate, add it to the connection
        channel.on('broadcast', { event: 'ice-candidate' }, async (msg) => {
            const { senderId, targetId, candidate } = msg.payload as {
                senderId: string;
                targetId: string;
                candidate: RTCIceCandidateInit;
            };
            if (targetId !== userId) return;

            const peer = peersRef.current.get(senderId);
            if (peer) {
                try {
                    await peer.connection.addIceCandidate(
                        new RTCIceCandidate(candidate),
                    );
                } catch (err) {
                    console.error('Error adding ICE candidate:', err);
                }
            }
        });

        // When a peer leaves, remove the connection
        channel.on('broadcast', { event: 'peer-left' }, (msg) => {
            const { senderId } = msg.payload as { senderId: string };
            removePeer(senderId);
        });

        // Handle incoming chat messages
        channel.on('broadcast', { event: 'chat-message' }, (msg) => {
            const chatMsg = msg.payload as ChatMessage;
            setChatMessages((prev) => [...prev, chatMsg]);
        });

        // Use presence to track who's in the room
        channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach((presence: Record<string, unknown>) => {
                const peerId = presence.userId as string;
                if (peerId && peerId !== userId) {
                    removePeer(peerId);
                }
            });
        });

        // Sync presence state to get the full participants list
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const list: RoomParticipant[] = [];
            for (const key of Object.keys(state)) {
                const presences = state[key] as unknown as Record<string, unknown>[];
                for (const p of presences) {
                    list.push({
                        userId: p.userId as string,
                        userName: p.userName as string,
                        joinedAt: p.online_at as string,
                    });
                }
            }
            setParticipants(list);
        });

        // Subscribe and announce presence
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Track presence
                await channel.track({
                    userId,
                    userName,
                    online_at: new Date().toISOString(),
                });

                // Broadcast that we've joined so existing peers create offers
                channel.send({
                    type: 'broadcast',
                    event: 'peer-joined',
                    payload: { senderId: userId, senderName: userName },
                });
            }
        });

        // Cleanup on unmount or dependency change
        return () => {
            // Broadcast that we're leaving
            channel.send({
                type: 'broadcast',
                event: 'peer-left',
                payload: { senderId: userId },
            });

            // Close all peer connections
            peersRef.current.forEach((peer) => {
                peer.connection.close();
            });
            peersRef.current.clear();
            syncPeers();

            // Unsubscribe from channel
            channel.untrack();
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, roomId, userId, userName, supabase, createPeerConnection, removePeer, syncPeers]);

    // When localStream changes (e.g., new tracks), update all existing peer connections
    useEffect(() => {
        if (!localStream) return;

        peersRef.current.forEach((peer) => {
            const senders = peer.connection.getSenders();
            localStream.getTracks().forEach((track) => {
                const existingSender = senders.find(
                    (s) => s.track?.kind === track.kind,
                );
                if (existingSender) {
                    existingSender.replaceTrack(track).catch(console.error);
                } else {
                    peer.connection.addTrack(track, localStream);
                }
            });
        });
    }, [localStream]);

    // Replace the video track in all peer connections (used for screen sharing)
    const replaceVideoTrack = useCallback(
        async (newTrack: MediaStreamTrack) => {
            const promises: Promise<void>[] = [];
            peersRef.current.forEach((peer) => {
                const sender = peer.connection
                    .getSenders()
                    .find((s) => s.track?.kind === 'video');
                if (sender) {
                    promises.push(sender.replaceTrack(newTrack));
                }
            });
            await Promise.all(promises);
        },
        [],
    );

    // Send a chat message via Realtime broadcast
    const sendChatMessage = useCallback(
        (message: string) => {
            if (!channelRef.current || !message.trim()) return;
            const chatMsg: ChatMessage = {
                id: `${userId}-${Date.now()}`,
                senderId: userId,
                senderName: userName,
                message: message.trim(),
                timestamp: new Date().toISOString(),
            };
            channelRef.current.send({
                type: 'broadcast',
                event: 'chat-message',
                payload: chatMsg,
            });
            // Add own message locally (broadcast self:false won't echo it back)
            setChatMessages((prev) => [...prev, chatMsg]);
        },
        [userId, userName],
    );

    return {
        peers,
        participants,
        channelRef,
        chatMessages,
        sendChatMessage,
        replaceVideoTrack,
    };
}
