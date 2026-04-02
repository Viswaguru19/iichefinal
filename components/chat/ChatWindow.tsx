'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Smile, Paperclip, BarChart3, Users, Check, CheckCheck, ArrowLeft, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import DynamicLogo from '@/components/DynamicLogo';
import type { ChatItem, UserProfile } from '@/app/dashboard/chat/page';
import { motionTokens } from '@/lib/ui/motion';

interface Props {
    chat: ChatItem;
    currentUser: UserProfile;
    onlineUsers: Set<string>;
    showOnlinePresence: boolean;
    onOpenProfile: (userId: string) => void;
    onMessageSent: () => void;
    onBack?: () => void;
}

const EMOJIS = ['😀', '😂', '😊', '😍', '🤝', '👍', '🔥', '🙌', '🙏', '🎉', '❤️', '😎', '🤔', '😢', '😡', '🥳', '💯', '👏', '🫡', '✨', '😅', '🥰', '😤', '🤩', '😴', '🤗', '😇', '🤣', '💪', '🎊'];

type ParticipantRow = { id: string; name: string; avatar_url: string | null; is_group_admin: boolean };

/** WhatsApp-style group receipts from per-member last_read_at vs message time */
type GroupReceiptLevel = 'sent' | 'delivered' | 'read';

function groupReceiptLevel(
    msg: { sender_id: string; created_at: string },
    memberLastRead: Record<string, string | null>,
    currentUserId: string,
): GroupReceiptLevel {
    if (msg.sender_id !== currentUserId) return 'sent';
    if (Object.keys(memberLastRead).length === 0) return 'sent';
    const msgT = new Date(msg.created_at).getTime();
    const otherIds = Object.keys(memberLastRead).filter((id) => id !== msg.sender_id);
    if (otherIds.length === 0) return 'read';
    let readBy = 0;
    for (const id of otherIds) {
        const lr = memberLastRead[id];
        if (lr && new Date(lr).getTime() >= msgT) readBy += 1;
    }
    if (readBy === 0) return 'sent';
    if (readBy < otherIds.length) return 'delivered';
    return 'read';
}

export default function ChatWindow({ chat, currentUser, onlineUsers, showOnlinePresence, onOpenProfile, onMessageSent, onBack }: Props) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
    const [pollQ, setPollQ] = useState('');
    const [pollOpts, setPollOpts] = useState(['', '']);
    const [pollMultiple, setPollMultiple] = useState(false);
    const [typing, setTyping] = useState<string | null>(null);
    const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
    const [showParticipants, setShowParticipants] = useState(false);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [participants, setParticipants] = useState<ParticipantRow[]>([]);
    const [iAmGroupAdmin, setIAmGroupAdmin] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [groupMemberLastRead, setGroupMemberLastRead] = useState<Record<string, string | null>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();
    const channelRef = useRef<any>(null);
    const isSendingRef = useRef(false);

    const isDirect = chat.type === 'direct';
    const isOnline = showOnlinePresence && isDirect && onlineUsers.has(chat.id);
    const canManageGroupMembers = !isDirect && chat.groupChatType === 'custom_group' && iAmGroupAdmin;

    useEffect(() => {
        setShowParticipants(false);
        setIAmGroupAdmin(false);
        setGroupMemberLastRead({});
    }, [chat.id, chat.type]);

    useEffect(() => {
        loadMessages();
        setupChannel();
        return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
    }, [chat.id, chat.type]);

    useEffect(() => {
        if (!showParticipants || isDirect || !chat.participantGroupId) return;
        let cancelled = false;
        (async () => {
            setParticipantsLoading(true);
            const { data: rows, error: pErr } = await supabase
                .from('chat_participants')
                .select('user_id, is_admin')
                .eq('group_id', chat.participantGroupId!);
            if (pErr) {
                console.error('participants load:', pErr);
                if (!cancelled) setParticipantsLoading(false);
                return;
            }
            const adminMap = Object.fromEntries((rows || []).map((r: { user_id: string; is_admin: boolean }) => [r.user_id, r.is_admin]));
            const myAdmin = !!(rows || []).find((r: { user_id: string; is_admin: boolean }) => r.user_id === currentUser.id)?.is_admin;
            if (!cancelled) setIAmGroupAdmin(myAdmin);
            const ids = [...new Set((rows || []).map((r: { user_id: string }) => r.user_id))];
            if (ids.length === 0) {
                if (!cancelled) { setParticipants([]); setParticipantsLoading(false); }
                return;
            }
            const { data: profs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', ids);
            const list: ParticipantRow[] = (profs || []).map((p: { id: string; name: string; avatar_url: string | null }) => ({
                id: p.id,
                name: p.name,
                avatar_url: p.avatar_url,
                is_group_admin: !!adminMap[p.id],
            })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            if (!cancelled) {
                setParticipants(list);
                setParticipantsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [showParticipants, isDirect, chat.participantGroupId, currentUser.id]);

    useEffect(() => { scrollToBottom(); }, [messages]);

    function scrollToBottom() { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }

    async function loadGroupMemberReads() {
        if (!chat.participantGroupId || isDirect) return;
        const { data, error } = await supabase
            .from('chat_participants')
            .select('user_id, last_read_at')
            .eq('group_id', chat.participantGroupId);
        if (error) {
            console.error('Group member reads load error:', error);
            return;
        }
        const map: Record<string, string | null> = {};
        for (const row of data || []) {
            const r = row as { user_id: string; last_read_at: string | null };
            map[r.user_id] = r.last_read_at;
        }
        setGroupMemberLastRead(map);
    }

    async function loadMessages() {
        setLoading(true);
        if (isDirect) {
            const { data: sent, error: e1 } = await supabase
                .from('direct_messages')
                .select('*')
                .eq('sender_id', currentUser.id)
                .eq('receiver_id', chat.id)
                .order('created_at', { ascending: true });

            const { data: received, error: e2 } = await supabase
                .from('direct_messages')
                .select('*')
                .eq('sender_id', chat.id)
                .eq('receiver_id', currentUser.id)
                .order('created_at', { ascending: true });

            if (e1) console.error('DM sent load error:', e1);
            if (e2) console.error('DM received load error:', e2);

            if (!e1 || !e2) {
                const all = [...(sent || []), ...(received || [])].sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                // Attach sender info manually
                const enriched = all.map(m => ({
                    ...m,
                    sender: m.sender_id === currentUser.id
                        ? { name: currentUser.name, avatar_url: currentUser.avatar_url }
                        : { name: chat.name, avatar_url: chat.avatar }
                }));
                if (enriched.length > 0 || (!e1 && !e2)) {
                    setMessages(enriched);
                }
            }

            if (!e2 && received && received.length > 0) {
                const { data: marked, error: markErr } = await supabase
                    .from('direct_messages')
                    .update({ read: true } as any)
                    .eq('receiver_id', currentUser.id)
                    .eq('sender_id', chat.id)
                    .select('id');
                if (markErr) console.error('DM read update error:', markErr);
                else if ((marked?.length || 0) > 0) onMessageSent();
            }
        } else {
            const { data, error } = await supabase
                .from('group_messages')
                .select('*')
                .eq('group_id', chat.id)
                .order('created_at', { ascending: true });
            if (error) { console.error('Group msg load error:', error); setLoading(false); return; }
            // Fetch sender profiles for group messages
            const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
            let senderMap: Record<string, any> = {};
            if (senderIds.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', senderIds);
                (profiles || []).forEach((p: any) => { senderMap[p.id] = p; });
            }
            const enriched = (data || []).map((m: any) => ({
                ...m,
                sender: senderMap[m.sender_id] || { name: 'Unknown', avatar_url: null }
            }));
            setMessages(enriched);
            if (chat.participantGroupId) {
                const { error: lrErr } = await supabase
                    .from('chat_participants')
                    .update({ last_read_at: new Date().toISOString() })
                    .eq('group_id', chat.participantGroupId)
                    .eq('user_id', currentUser.id)
                    .select('group_id');
                if (lrErr) console.error('last_read_at update:', lrErr);
                else onMessageSent();
                await loadGroupMemberReads();
            }
        }
        setLoading(false);
    }

    function setupChannel() {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        const table = isDirect ? 'direct_messages' : 'group_messages';
        const ch = supabase.channel(`chat-${chat.type}-${chat.id}`);
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload) => {
            const msg = payload.new as any;
            if (msg.sender_id === currentUser.id) return;
            const isRelevant = isDirect
                ? (msg.sender_id === chat.id && msg.receiver_id === currentUser.id)
                : msg.group_id === chat.id;
            if (isRelevant) loadMessages();
        });
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, (payload) => {
            const msg = payload.new as any;
            if (isDirect) {
                const inThread =
                    (msg.sender_id === chat.id && msg.receiver_id === currentUser.id) ||
                    (msg.sender_id === currentUser.id && msg.receiver_id === chat.id);
                if (inThread) loadMessages();
                return;
            }
            if (msg.poll_data) loadMessages();
        });
        ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (payload.user_id !== currentUser.id) { setTyping(payload.name); setTimeout(() => setTyping(null), 3000); }
        });
        if (!isDirect && chat.participantGroupId) {
            ch.on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_participants',
                    filter: `group_id=eq.${chat.participantGroupId}`,
                },
                () => { void loadGroupMemberReads(); },
            );
        }
        ch.subscribe();
        channelRef.current = ch;
    }

    function handleTyping() {
        channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: currentUser.id, name: currentUser.name } });
    }

    async function sendMessage(e?: React.FormEvent) {
        e?.preventDefault();
        if (!newMessage.trim()) return;
        const text = newMessage.trim();
        setNewMessage('');
        setShowEmoji(false);
        isSendingRef.current = true;

        // Optimistic update — show message immediately
        const tempMsg = {
            id: `temp-${Date.now()}`,
            sender_id: currentUser.id,
            message: text,
            created_at: new Date().toISOString(),
            sender: { name: currentUser.name, avatar_url: currentUser.avatar_url },
            ...(isDirect ? { receiver_id: chat.id } : { group_id: chat.id }),
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            if (isDirect) {
                const { data: inserted, error } = await supabase.from('direct_messages').insert({ sender_id: currentUser.id, receiver_id: chat.id, message: text, read: false } as any).select().single();
                if (error) { console.error('DM insert error:', error); toast.error('Failed to send: ' + error.message); setMessages(prev => prev.filter(m => m.id !== tempMsg.id)); setNewMessage(text); return; }
                // Replace temp message with real one, add sender info manually
                if (inserted) {
                    const realMsg = { ...inserted, sender: { name: currentUser.name, avatar_url: currentUser.avatar_url } };
                    setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m));
                }
            } else {
                const { data: inserted, error } = await supabase.from('group_messages').insert({ group_id: chat.id, sender_id: currentUser.id, message: text } as any).select().single();
                if (error) { console.error('Group msg insert error:', error); toast.error('Failed to send: ' + error.message); setMessages(prev => prev.filter(m => m.id !== tempMsg.id)); setNewMessage(text); return; }
                if (inserted) {
                    const realMsg = { ...inserted, sender: { name: currentUser.name, avatar_url: currentUser.avatar_url } };
                    setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m));
                }
            }
            onMessageSent();
        } finally {
            isSendingRef.current = false;
        }
    }

    async function sendFile(file: File) {
        if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }
        const ext = file.name.split('.').pop();
        const path = `chat-files/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
        if (upErr) { toast.error('Upload failed: ' + upErr.message); return; }
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        const text = `📎 ${file.name}`;
        isSendingRef.current = true;
        if (isDirect) {
            const { error } = await supabase.from('direct_messages').insert({ sender_id: currentUser.id, receiver_id: chat.id, message: text, file_url: data.publicUrl, read: false } as any);
            if (error) { toast.error('Failed to send file'); isSendingRef.current = false; return; }
        } else {
            const { error } = await supabase.from('group_messages').insert({ group_id: chat.id, sender_id: currentUser.id, message: text, file_url: data.publicUrl } as any);
            if (error) { toast.error('Failed to send file'); isSendingRef.current = false; return; }
        }
        await loadMessages();
        isSendingRef.current = false;
        onMessageSent();
    }

    async function sendPoll() {
        if (!pollQ.trim() || pollOpts.filter(o => o.trim()).length < 2) { toast.error('Need question + 2 options'); return; }
        const pollData = { question: pollQ.trim(), options: pollOpts.filter(o => o.trim()), votes: {} as Record<string, string[]>, allowMultiple: pollMultiple };
        const text = `📊 ${pollQ}`;
        if (isDirect) await supabase.from('direct_messages').insert({ sender_id: currentUser.id, receiver_id: chat.id, message: text, poll_data: pollData, read: false } as any);
        else await supabase.from('group_messages').insert({ group_id: chat.id, sender_id: currentUser.id, message: text, poll_data: pollData } as any);
        setShowPoll(false); setPollQ(''); setPollOpts(['', '']); setPollMultiple(false);
        isSendingRef.current = true;
        await loadMessages();
        isSendingRef.current = false;
        onMessageSent();
    }

    async function votePoll(msgId: string, option: string) {
        const msg = messages.find(m => m.id === msgId);
        if (!msg?.poll_data) return;
        const votes = { ...msg.poll_data.votes };
        const myVotes: string[] = votes[currentUser.id] || [];
        if (msg.poll_data.allowMultiple) {
            if (myVotes.includes(option)) votes[currentUser.id] = myVotes.filter(v => v !== option);
            else votes[currentUser.id] = [...myVotes, option];
        } else {
            votes[currentUser.id] = [option];
        }
        // Optimistically update the message in state
        const updatedPoll = { ...msg.poll_data, votes };
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, poll_data: updatedPoll } : m));
        isSendingRef.current = true;
        const table = isDirect ? 'direct_messages' : 'group_messages';
        await supabase.from(table).update({ poll_data: updatedPoll } as any).eq('id', msgId);
        isSendingRef.current = false;
    }

    async function removeGroupMember(userId: string) {
        if (!chat.participantGroupId || userId === currentUser.id) return;
        setRemovingId(userId);
        const { error, data } = await supabase
            .from('chat_participants')
            .delete()
            .eq('group_id', chat.participantGroupId)
            .eq('user_id', userId)
            .select('user_id');
        setRemovingId(null);
        if (error) {
            toast.error(error.message || 'Could not remove member');
            return;
        }
        if (!data?.length) {
            toast.error('Remove was not allowed (only custom group admins can remove others).');
            return;
        }
        toast.success('Member removed');
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
        onMessageSent();
    }

    async function deleteMessage(msgId: string) {
        if (String(msgId).startsWith('temp-')) {
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
            setMenuMsgId(null);
            return;
        }
        const table = isDirect ? 'direct_messages' : 'group_messages';
        const { data, error } = await supabase
            .from(table)
            .delete()
            .eq('id', msgId)
            .eq('sender_id', currentUser.id)
            .select('id');
        if (error) {
            toast.error(`Failed to delete: ${error.message}`);
            return;
        }
        if (!data || data.length === 0) {
            toast.error('Could not delete this message. If it persists, refresh the page and try again.');
            return;
        }
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMenuMsgId(null);
        await loadMessages();
        onMessageSent();
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#0b141a]">
            {/* Header */}
            <div className="px-2 sm:px-4 py-2.5 bg-[#202c33] flex items-center gap-2 sm:gap-3 border-b border-[#2a3942]">
                {onBack && (
                    <button onClick={onBack} className="sm:hidden text-gray-400 hover:text-white p-1">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => isDirect && onOpenProfile(chat.id)}>
                    <div className="relative">
                        {chat.avatar ? (
                            <img src={chat.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                {chat.type === 'group' ? <Users className="w-5 h-5" /> : (chat.name || '?')[0]?.toUpperCase()}
                            </div>
                        )}
                        {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#202c33]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-white text-base truncate">{chat.name || 'Chat'}</h2>
                        <p className="text-xs text-gray-400">
                            {typing ? (
                                <span className="text-emerald-400 italic">{typing} is typing...</span>
                            ) : isDirect ? (
                                showOnlinePresence ? (isOnline ? 'Online' : 'Offline') : 'Direct message'
                            ) : (
                                'Group chat'
                            )}
                        </p>
                    </div>
                </div>
                {!isDirect && chat.participantGroupId && (
                    <button
                        type="button"
                        onClick={() => setShowParticipants(true)}
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#2a3942] shrink-0"
                        title="View participants"
                    >
                        <Users className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative">
                {/* IIChE Logo Watermark - fixed center */}
                <div className="sticky top-1/2 left-1/2 -translate-y-1/2 w-full flex items-center justify-center pointer-events-none" style={{ height: 0, zIndex: 0 }}>
                    <div className="opacity-[0.15]">
                        <DynamicLogo width={320} height={320} />
                    </div>
                </div>

                <div className="relative z-10">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`h-10 rounded-lg shimmer ${i % 2 === 0 ? 'w-48 bg-[#005c4b]/30' : 'w-56 bg-[#202c33]'}`} />
                                </div>
                            ))}
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="bg-[#202c33] px-4 py-2 rounded-lg text-base text-gray-400 shadow-sm">No messages yet. Say hello! 👋</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isSent = msg.sender_id === currentUser.id;
                            const showName = !isDirect && !isSent;
                            const prevMsg = messages[idx - 1];
                            const showDate = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                            const isPoll = msg.poll_data?.question;

                            return (
                                <div key={msg.id}>
                                    {showDate && (
                                        <div className="flex justify-center my-3">
                                            <span className="bg-[#182229] text-gray-400 text-[11px] px-3 py-1 rounded-lg shadow-sm font-medium">
                                                {new Date(msg.created_at).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: motionTokens.easing }}
                                        className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-0.5 group/msg relative`}>
                                        <div className={`max-w-[65%] px-3 py-1.5 rounded-lg shadow-sm relative ${isSent ? 'bg-[#005c4b]' : 'bg-[#202c33]'}`}
                                            onClick={() => isSent && setMenuMsgId(menuMsgId === msg.id ? null : msg.id)}>
                                            {showName && <p className="text-[12px] font-semibold text-emerald-400 mb-0.5">{msg.sender?.name}</p>}

                                            {isPoll ? (
                                                <PollBubble poll={msg.poll_data} msgId={msg.id} myId={currentUser.id} onVote={votePoll} />
                                            ) : msg.file_url ? (
                                                <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-[15px] text-emerald-300 hover:text-emerald-200 font-medium">
                                                    <Paperclip className="w-4 h-4" />
                                                    <span className="underline">{msg.message?.replace('📎 ', '') || 'Download File'}</span>
                                                </a>
                                            ) : (
                                                <p className="text-[15px] text-gray-100 break-words whitespace-pre-wrap leading-[22px]">{msg.message}</p>
                                            )}

                                            <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5">
                                                <span className="text-[10.5px] text-gray-500">{new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                {isSent && (() => {
                                                    if (isDirect) {
                                                        return msg.read ? (
                                                            <span title="Read"><CheckCheck className="w-3.5 h-3.5 text-blue-400" /></span>
                                                        ) : (
                                                            <span title="Sent · not read yet"><CheckCheck className="w-3.5 h-3.5 text-gray-500" /></span>
                                                        );
                                                    }
                                                    const lvl = groupReceiptLevel(msg, groupMemberLastRead, currentUser.id);
                                                    if (lvl === 'sent') {
                                                        return <span title="Sent · no one else has read yet"><Check className="w-3.5 h-3.5 text-gray-500" /></span>;
                                                    }
                                                    if (lvl === 'delivered') {
                                                        return <span title="Read by some members"><CheckCheck className="w-3.5 h-3.5 text-gray-500" /></span>;
                                                    }
                                                    return <span title="Read by everyone in the group"><CheckCheck className="w-3.5 h-3.5 text-blue-400" /></span>;
                                                })()}
                                            </div>

                                            {/* Delete menu */}
                                            {isSent && menuMsgId === msg.id && (
                                                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18, ease: motionTokens.easing }}
                                                    className="absolute -top-10 right-0 bg-[#233138] rounded-lg shadow-xl border border-[#2a3942] z-20 overflow-hidden">
                                                    <button onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                                                        className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-[#2a3942] text-xs font-medium whitespace-nowrap">
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-3 py-2 bg-[#202c33] flex items-center gap-2 relative">
                <div className="relative">
                    <button type="button" onClick={() => setShowEmoji(v => !v)} className="p-2 text-gray-400 hover:text-white transition-colors">
                        <Smile className="w-6 h-6" />
                    </button>
                    <AnimatePresence>
                        {showEmoji && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: motionTokens.easing }}
                                className="absolute bottom-14 left-0 bg-[#233138] rounded-2xl shadow-2xl p-4 grid grid-cols-6 gap-2 z-50 border border-[#2a3942] w-[280px]">
                                {EMOJIS.map(e => (
                                    <button key={e} type="button" onClick={() => { setNewMessage(p => p + e); setShowEmoji(false); }}
                                        className="text-2xl hover:bg-[#2a3942] rounded-lg p-2 transition-colors flex items-center justify-center">{e}</button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="p-2 text-gray-400 hover:text-white transition-colors">
                    <Paperclip className="w-5 h-5" />
                </button>
                <button type="button" onClick={() => setShowPoll(true)} className="p-2 text-gray-400 hover:text-white transition-colors">
                    <BarChart3 className="w-5 h-5" />
                </button>
                <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ''; }} />
                <input type="text" value={newMessage} onChange={e => { setNewMessage(e.target.value); handleTyping(); }} placeholder="Type a message"
                    className="flex-1 px-4 py-2.5 bg-[#2a3942] rounded-lg text-base text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all" />
                <motion.button whileHover={{ scale: 1.03 }} whileTap={motionTokens.tap} type="submit" disabled={!newMessage.trim()}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white disabled:opacity-40 shadow-md">
                    <Send className="w-4 h-4" />
                </motion.button>
            </form>

            {/* Poll Modal - WhatsApp Style */}
            <AnimatePresence>
                {showPoll && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.modal.duration }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} transition={{ duration: motionTokens.modal.duration, ease: motionTokens.easing }} className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                            <div className="bg-[#00a884] px-5 py-4">
                                <h2 className="text-white font-bold text-lg">Create poll</h2>
                            </div>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question</label>
                                    <input type="text" value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="Ask a question"
                                        className="w-full mt-1 border-b-2 border-gray-200 focus:border-[#00a884] outline-none py-2 text-sm transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Options</label>
                                    <div className="space-y-2 mt-2">
                                        {pollOpts.map((o, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                                                <input type="text" value={o} onChange={e => { const n = [...pollOpts]; n[i] = e.target.value; setPollOpts(n); }}
                                                    placeholder={`Option ${i + 1}`} className="flex-1 border-b border-gray-200 focus:border-[#00a884] outline-none py-1.5 text-sm transition-colors" />
                                                {pollOpts.length > 2 && (
                                                    <button onClick={() => setPollOpts(pollOpts.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {pollOpts.length < 8 && (
                                        <button onClick={() => setPollOpts([...pollOpts, ''])} className="text-sm text-[#00a884] font-medium mt-2 hover:underline">+ Add option</button>
                                    )}
                                </div>
                                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                    <input type="checkbox" checked={pollMultiple} onChange={e => setPollMultiple(e.target.checked)} className="rounded text-[#00a884]" />
                                    Allow multiple answers
                                </label>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={sendPoll} className="flex-1 bg-[#00a884] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#008f72] transition-colors">Send poll</button>
                                    <button onClick={() => { setShowPoll(false); setPollQ(''); setPollOpts(['', '']); setPollMultiple(false); }}
                                        className="flex-1 bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-colors">Cancel</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showParticipants && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: motionTokens.modal.duration }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-4"
                        onClick={() => setShowParticipants(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.96, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 16 }}
                            transition={{ duration: motionTokens.modal.duration, ease: motionTokens.easing }}
                            className="bg-[#233138] rounded-2xl max-w-md w-full max-h-[75vh] shadow-2xl border border-[#2a3942] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-4 py-3 border-b border-[#2a3942] flex items-center justify-between gap-2">
                                <h2 className="text-white font-semibold text-lg">Participants</h2>
                                <button type="button" onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white p-1 text-xl leading-none" aria-label="Close">
                                    ✕
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-3 min-h-[120px]">
                                {participantsLoading ? (
                                    <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
                                ) : participants.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-6">No members found.</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {participants.map((p) => (
                                            <li
                                                key={p.id}
                                                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#2a3942]/80"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (p.id !== currentUser.id) {
                                                            setShowParticipants(false);
                                                            onOpenProfile(p.id);
                                                        }
                                                    }}
                                                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                                >
                                                    <div className="relative flex-shrink-0">
                                                        {p.avatar_url ? (
                                                            <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                                                {(p.name || '?')[0]?.toUpperCase()}
                                                            </div>
                                                        )}
                                                        {showOnlinePresence && onlineUsers.has(p.id) && (
                                                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#233138]" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white font-medium truncate">
                                                            {p.name}
                                                            {p.id === currentUser.id ? ' (you)' : ''}
                                                        </p>
                                                        {p.is_group_admin && (
                                                            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">Group admin</p>
                                                        )}
                                                    </div>
                                                </button>
                                                {canManageGroupMembers && p.id !== currentUser.id && (
                                                    <button
                                                        type="button"
                                                        disabled={removingId === p.id}
                                                        onClick={() => void removeGroupMember(p.id)}
                                                        className="text-xs font-medium text-red-400 hover:text-red-300 px-2 py-1 rounded disabled:opacity-40 shrink-0"
                                                    >
                                                        {removingId === p.id ? '…' : 'Remove'}
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            {chat.groupChatType !== 'custom_group' && (
                                <p className="text-[11px] text-gray-500 px-4 pb-3 pt-0">
                                    This is an organization or committee chat. Members are managed automatically; you can view the list here.
                                </p>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* Clean Poll Bubble with voter visibility */
function PollBubble({ poll, msgId, myId, onVote, allUsers }: { poll: any; msgId: string; myId: string; onVote: (msgId: string, option: string) => void; allUsers?: any[] }) {
    const [showVoters, setShowVoters] = useState(false);
    const myVotes: string[] = poll.votes?.[myId] || [];
    const hasVoted = myVotes.length > 0;
    const totalVoters = Object.keys(poll.votes || {}).length;

    function getVotersForOption(opt: string): string[] {
        const voterIds: string[] = [];
        for (const [userId, votes] of Object.entries(poll.votes || {})) {
            if ((votes as string[]).includes(opt)) voterIds.push(userId);
        }
        return voterIds;
    }

    function getVoterName(userId: string): string {
        if (userId === myId) return 'You';
        const user = allUsers?.find((u: any) => u.id === userId);
        return user?.name || 'Unknown';
    }

    return (
        <>
            <div className="min-w-[300px] max-w-[380px]">
                <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
                        <span className="text-white text-base">📊</span>
                    </div>
                    <div>
                        <p className="font-bold text-[15px] text-gray-900 leading-tight">{poll.question}</p>
                        {poll.allowMultiple && <p className="text-[11px] text-gray-400 mt-0.5">Select one or more</p>}
                    </div>
                </div>
                <div className="space-y-2.5">
                    {poll.options.map((opt: string, i: number) => {
                        const voters = getVotersForOption(opt);
                        const count = voters.length;
                        const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
                        const isMyVote = myVotes.includes(opt);
                        return (
                            <button key={i} onClick={() => onVote(msgId, opt)}
                                className={`w-full text-left rounded-xl text-sm transition-all relative overflow-hidden border-2 ${isMyVote ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                {hasVoted && (
                                    <div className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-xl ${isMyVote ? 'bg-indigo-100' : 'bg-gray-50'}`} style={{ width: `${pct}%` }} />
                                )}
                                <div className="relative z-10 px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isMyVote ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                                            {isMyVote && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={`${isMyVote ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{opt}</span>
                                    </div>
                                    {hasVoted && (
                                        <span className="text-xs font-bold text-gray-500 ml-2">{pct}%</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400">{totalVoters} vote{totalVoters !== 1 ? 's' : ''}</p>
                    {hasVoted && totalVoters > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setShowVoters(true); }}
                            className="text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold">
                            View Votes
                        </button>
                    )}
                </div>
            </div>

            {/* Vote Viewer Modal */}
            <AnimatePresence>
                {showVoters && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.modal.duration }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
                        onClick={() => setShowVoters(false)}>
                        <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} transition={{ duration: motionTokens.modal.duration, ease: motionTokens.easing }}
                            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden max-h-[70vh] flex flex-col"
                            onClick={e => e.stopPropagation()}>
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 flex items-center justify-between">
                                <h2 className="text-white font-bold text-lg">Poll Results</h2>
                                <button onClick={() => setShowVoters(false)} className="text-white/80 hover:text-white text-xl font-bold">✕</button>
                            </div>
                            <div className="p-5 overflow-y-auto flex-1">
                                <p className="font-semibold text-gray-800 mb-4">{poll.question}</p>
                                <div className="space-y-4">
                                    {poll.options.map((opt: string, i: number) => {
                                        const voters = getVotersForOption(opt);
                                        const pct = totalVoters > 0 ? Math.round((voters.length / totalVoters) * 100) : 0;
                                        return (
                                            <div key={i} className="border border-gray-100 rounded-xl p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-gray-800">{opt}</span>
                                                    <span className="text-sm font-bold text-indigo-600">{pct}% ({voters.length})</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                                                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                                {voters.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {voters.map(vid => (
                                                            <div key={vid} className="flex items-center gap-2 text-sm text-gray-600">
                                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                                                                    {getVoterName(vid)[0]?.toUpperCase()}
                                                                </div>
                                                                <span>{getVoterName(vid)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400">No votes</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-center text-xs text-gray-400 mt-4">{totalVoters} total voter{totalVoters !== 1 ? 's' : ''}</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
