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
export interface ChatMessage { id: string; senderId: string; senderName: string; message: string; timestamp: string; }
export interface RoomParticipant { userId: string; userName: string; userRole?: string | null; joinedAt: string; }

interface UseWebRTCOptions {
    supabase: SupabaseClient; roomId: string; userId: string; userName: string;
    userRole?: string | null; localStream: MediaStream | null; enabled: boolean;
}

export function useWebRTC({ supabase, roomId, userId, userName, userRole, localStream, enabled }: UseWebRTCOptions) {
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<RoomParticipant[]>([]);
    const peersRef = useRef<Map<string, PeerState>>(new Map());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const userIdRef = useRef(userId);
    const userNameRef = useRef(userName);

    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { userNameRef.current = userName; }, [userName]);

    const syncPeers = useCallback(() => { setPeers(new Map(peersRef.current)); }, []);

    // These are NOT useCallbacks — they use refs so they never go stale
    function createPC(peerId: string, peerName: string): RTCPeerConnection {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => { pc.addTrack(track, localStreamRef.current!); });
        }
        const remoteStream = new MediaStream();
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
        peersRef.current.set(peerId, { connection: pc, remoteStream, userName: peerName });
        syncPeers();
        return pc;
    }

    function removePC(peerId: string) {
        const p = peersRef.current.get(peerId);
        if (p) { p.connection.close(); peersRef.current.delete(peerId); syncPeers(); }
    }

    // Main effect — only depends on stable values, NOT on callbacks
    useEffect(() => {
        if (!enabled || !roomId || !userId) return;
        const channel = supabase.channel(`room:${roomId}`, { config: { broadcast: { self: false } } });
        channelRef.current = channel;

        channel.on('broadcast', { event: 'peer-joined' }, async (msg) => {
            const { senderId, senderName } = msg.payload as { senderId: string; senderName: string };
            if (senderId === userIdRef.current || peersRef.current.has(senderId)) return;
            const pc = createPC(senderId, senderName);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel.send({ type: 'broadcast', event: 'sdp-offer', payload: { senderId: userIdRef.current, senderName: userNameRef.current, targetId: senderId, sdp: pc.localDescription } });
            } catch (err) { console.error('Offer error:', err); }
        });

        channel.on('broadcast', { event: 'sdp-offer' }, async (msg) => {
            const { senderId, senderName, targetId, sdp } = msg.payload as { senderId: string; senderName: string; targetId: string; sdp: RTCSessionDescriptionInit };
            if (targetId !== userIdRef.current) return;
            if (peersRef.current.has(senderId)) { peersRef.current.get(senderId)!.connection.close(); peersRef.current.delete(senderId); }
            const pc = createPC(senderId, senderName);
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

        channel.on('broadcast', { event: 'peer-left' }, (msg) => { removePC((msg.payload as { senderId: string }).senderId); });
        channel.on('broadcast', { event: 'chat-message' }, (msg) => { setChatMessages(prev => [...prev, msg.payload as ChatMessage]); });
        channel.on('presence', { event: 'leave' }, ({ leftPresences }) => { leftPresences.forEach((p: any) => { if (p.userId && p.userId !== userIdRef.current) removePC(p.userId); }); });
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const list: RoomParticipant[] = [];
            for (const key of Object.keys(state)) { for (const p of state[key] as any[]) { list.push({ userId: p.userId, userName: p.userName, userRole: p.userRole || null, joinedAt: p.online_at }); } }
            setParticipants(list);
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ userId, userName, userRole: userRole || null, online_at: new Date().toISOString() });
                await new Promise(r => setTimeout(r, 500));
                channel.send({ type: 'broadcast', event: 'peer-joined', payload: { senderId: userId, senderName: userName } });
            }
        });

        return () => {
            channel.send({ type: 'broadcast', event: 'peer-left', payload: { senderId: userIdRef.current } });
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

    const sendChatMessage = useCallback((message: string) => {
        if (!channelRef.current || !message.trim()) return;
        const chatMsg: ChatMessage = { id: `${userIdRef.current}-${Date.now()}`, senderId: userIdRef.current, senderName: userNameRef.current, message: message.trim(), timestamp: new Date().toISOString() };
        channelRef.current.send({ type: 'broadcast', event: 'chat-message', payload: chatMsg });
        setChatMessages(prev => [...prev, chatMsg]);
    }, []);

    return { peers, participants, channelRef, chatMessages, sendChatMessage, replaceVideoTrack };
}
