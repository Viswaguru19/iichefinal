'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import ProfilePanel from '@/components/chat/ProfilePanel';
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export interface ChatItem {
  id: string;
  name: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  type: 'direct' | 'group';
  unreadCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  executive_role: string | null;
  is_faculty: boolean;
  department: string | null;
  phone: string | null;
  created_at: string;
  committee_name?: string;
  committee_position?: string;
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // Load current user profile with committee info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (!profile) return;

    const { data: membership } = await supabase
      .from('committee_members')
      .select('position, committees(name)')
      .eq('user_id', user.id)
      .neq('committee_id', '00000000-0000-0000-0000-000000000001')
      .limit(1)
      .single();

    const currentProfile: UserProfile = {
      ...profile,
      committee_name: (membership as any)?.committees?.name || null,
      committee_position: membership?.position || null,
    };
    setCurrentUser(currentProfile);

    // Load all users for new chat / search
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .order('name');
    // Resolve avatar URLs from storage paths to public URLs
    const usersWithAvatars = (users || []).map((u: any) => {
      if (u.avatar_url && !u.avatar_url.startsWith('http')) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(u.avatar_url);
        return { ...u, avatar_url: data.publicUrl };
      }
      return u;
    });
    setAllUsers(usersWithAvatars);

    await loadChats(user.id);
    setLoading(false);
    setupRealtime(user.id);
    setupPresence(user.id);
  }

  async function loadChats(userId: string) {
    // Direct messages
    const { data: dms } = await supabase
      .from('direct_messages')
      .select('*, sender:profiles!direct_messages_sender_id_fkey(id, name, avatar_url), receiver:profiles!direct_messages_receiver_id_fkey(id, name, avatar_url)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    const convos = new Map<string, ChatItem>();
    const unread: Record<string, number> = {};
    dms?.forEach((msg: any) => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const other = msg.sender_id === userId ? msg.receiver : msg.sender;
      if (msg.receiver_id === userId && !msg.read) unread[otherId] = (unread[otherId] || 0) + 1;
      if (!convos.has(otherId)) {
        let avatarUrl = other?.avatar_url || null;
        if (avatarUrl && !avatarUrl.startsWith('http')) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
          avatarUrl = data.publicUrl;
        }
        convos.set(otherId, {
          id: otherId, name: other?.name || 'Unknown', avatar: avatarUrl,
          lastMessage: msg.message, time: msg.created_at, type: 'direct', unreadCount: 0,
        });
      }
    });
    const directChats = Array.from(convos.values()).map(c => ({ ...c, unreadCount: unread[c.id] || 0 }));

    // Committee group chats
    const { data: memberships } = await supabase
      .from('committee_members')
      .select('committee_id, committees(name)')
      .eq('user_id', userId);
    const groupChats: ChatItem[] = (memberships || []).map((m: any) => ({
      id: m.committee_id, name: m.committees.name, avatar: null,
      lastMessage: 'Group chat', time: new Date().toISOString(), type: 'group' as const, unreadCount: 0,
    }));

    // Special groups
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const specials: ChatItem[] = [
      { id: 'iiche-main', name: 'IIChE AVVU SC', avatar: null, lastMessage: 'Main group', time: new Date().toISOString(), type: 'group', unreadCount: 0 },
    ];
    if (prof?.role === 'committee_head') specials.push({ id: 'all-heads', name: '👑 All Heads', avatar: null, lastMessage: 'Heads group', time: new Date().toISOString(), type: 'group', unreadCount: 0 });
    if (prof?.role === 'committee_cohead') specials.push({ id: 'all-coheads', name: '⭐ All Co-Heads', avatar: null, lastMessage: 'Co-Heads group', time: new Date().toISOString(), type: 'group', unreadCount: 0 });

    setChats(prev => {
      const newChats = [...directChats, ...specials, ...groupChats];
      // Preserve any active chat that was started but has no DB messages yet
      const activeId = activeChat?.id;
      if (activeId && activeChat?.type === 'direct' && !newChats.find(c => c.id === activeId && c.type === 'direct')) {
        const existing = prev.find(c => c.id === activeId && c.type === 'direct');
        if (existing) newChats.unshift(existing);
      }
      return newChats;
    });
  }

  function setupRealtime(userId: string) {
    const ch = supabase.channel('chat-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => loadChats(userId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => loadChats(userId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }

  function setupPresence(userId: string) {
    const ch = supabase.channel('online-users', { config: { presence: { key: userId } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      setOnlineUsers(new Set(Object.keys(state)));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ user_id: userId, online_at: new Date().toISOString() });
    });
    return () => { supabase.removeChannel(ch); };
  }

  function openChat(chat: ChatItem) {
    setActiveChat(chat);
    setShowProfile(false);
    // Mark as read
    if (chat.type === 'direct' && currentUser) {
      supabase.from('direct_messages').update({ read: true } as any).eq('receiver_id', currentUser.id).eq('sender_id', chat.id).then(() => {
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
      });
    }
  }

  function startNewChat(user: UserProfile) {
    const existing = chats.find(c => c.type === 'direct' && c.id === user.id);
    if (existing) { openChat(existing); return; }
    const newChat: ChatItem = { id: user.id, name: user.name, avatar: user.avatar_url, lastMessage: '', time: new Date().toISOString(), type: 'direct', unreadCount: 0 };
    setChats(prev => [newChat, ...prev]);
    openChat(newChat);
  }

  async function createGroup(name: string, description: string, memberIds: string[]) {
    if (!currentUser) return;
    try {
      const { data: group, error } = await supabase.from('chat_groups').insert({
        name, description: description || null, chat_type: 'custom_group', created_by: currentUser.id,
      }).select().single();
      if (error) throw error;
      // Add creator + selected members
      const participants = [currentUser.id, ...memberIds].map(uid => ({ group_id: group.id, user_id: uid, is_admin: uid === currentUser.id }));
      await supabase.from('chat_participants').insert(participants);
      const newChat: ChatItem = { id: group.id, name, avatar: null, lastMessage: 'Group created', time: new Date().toISOString(), type: 'group', unreadCount: 0 };
      setChats(prev => [newChat, ...prev]);
      openChat(newChat);
      toast.success('Group created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group');
    }
  }

  async function openProfile(userId: string) {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!prof) return;
    const { data: mem } = await supabase.from('committee_members').select('position, committees(name)').eq('user_id', userId).neq('committee_id', '00000000-0000-0000-0000-000000000001').limit(1).single();
    setProfileUser({ ...prof, committee_name: (mem as any)?.committees?.name || null, committee_position: mem?.position || null });
    setShowProfile(true);
  }

  const refreshChats = useCallback(() => { if (currentUser) loadChats(currentUser.id); }, [currentUser, activeChat]);

  if (loading) {
    return (
      <div className="h-screen bg-mesh flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-4 animate-pulse-glow" />
          <p className="text-gray-400">Loading chats...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        allUsers={allUsers}
        activeChat={activeChat}
        onlineUsers={onlineUsers}
        onSelectChat={openChat}
        onNewChat={startNewChat}
        onCreateGroup={createGroup}
        onBack={() => router.push('/dashboard')}
      />

      {/* Chat Window or Empty State */}
      <div className="flex-1 flex">
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            currentUser={currentUser!}
            onlineUsers={onlineUsers}
            onOpenProfile={openProfile}
            onMessageSent={refreshChats}
          />
        ) : (
          <div className="flex-1 bg-[#f0f2f5] flex flex-col items-center justify-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="w-64 h-64 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <MessageSquare className="w-24 h-24 text-indigo-300" />
                </div>
              </div>
              <h2 className="text-3xl font-light text-gray-600 mb-2">IIChE Chat</h2>
              <p className="text-gray-400 text-sm max-w-md">Send and receive messages. Select a chat from the sidebar or start a new conversation.</p>
            </motion.div>
          </div>
        )}

        {/* Profile Panel */}
        <AnimatePresence>
          {showProfile && profileUser && (
            <ProfilePanel user={profileUser} isOnline={onlineUsers.has(profileUser.id)} onClose={() => setShowProfile(false)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
