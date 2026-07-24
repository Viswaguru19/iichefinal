'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import ProfilePanel from '@/components/chat/ProfilePanel';
import { MessageSquare } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { groupMessagesChannelId } from '@/lib/chat-group-keys';
import { usePortalPresence } from '@/components/dashboard/PortalPresenceContext';

export interface ChatItem {
  id: string;
  name: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  type: 'direct' | 'group';
  unreadCount: number;
  participantGroupId?: string;
  groupChatType?: string | null;
}

const WHOLE_ORG_CHAT_GROUP_ID = '00000000-0000-0000-0000-000000000001';

function displayGroupName(g: { name?: string | null; chat_type: string | null }) {
  if (g.chat_type === 'organization') return 'IIChE AVVU SC';
  if (g.chat_type === 'executive') return 'Executive Committee';
  const n = g.name?.trim();
  return n || 'Group';
}

function previewFromMessageRow(msg: {
  message?: string | null;
  file_url?: string | null;
  poll_data?: unknown;
} | null) {
  if (!msg) return 'No messages yet';
  const t = msg.message?.trim();
  if (t) return t;
  if (msg.file_url) return '📎 Attachment';
  if (msg.poll_data != null) return '📊 Poll';
  return 'Message';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  executive_role: string | null;
  is_faculty: boolean;
  is_admin?: boolean;
  department: string | null;
  phone: string | null;
  created_at: string;
  committee_name?: string;
  committee_position?: string;
}

function ChatPageInner() {
  const { onlineUserIds, showOnlinePresence } = usePortalPresence();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userIdRef = useRef<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkRef = useRef<string | null>(null);
  const activeChatRef = useRef<ChatItem | null>(null);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const scheduleReloadChats = useCallback(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      void loadChats(uid);
    }, 450);
  }, []);

  const syncChatUrl = useCallback((chat: ChatItem | null) => {
    if (!chat) {
      router.replace('/dashboard/chat', { scroll: false });
      return;
    }
    const q =
      chat.type === 'direct'
        ? `?user=${encodeURIComponent(chat.id)}`
        : `?group=${encodeURIComponent(chat.id)}`;
    router.replace(`/dashboard/chat${q}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    let removeRealtime: (() => void) | undefined;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      userIdRef.current = user.id;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
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

      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('name');

      const usersWithAvatars = (users || []).map((u: any) => {
        if (u.avatar_url && !u.avatar_url.startsWith('http')) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(u.avatar_url);
          return { ...u, avatar_url: data.publicUrl };
        }
        return u;
      });
      setAllUsers(usersWithAvatars);

      const { error: ensureErr } = await supabase.rpc('ensure_default_chat_memberships');
      if (ensureErr) console.warn('ensure_default_chat_memberships:', ensureErr.message);

      await loadChats(user.id);
      setLoading(false);

      const ch = supabase
        .channel('chat-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => scheduleReloadChats())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, () => scheduleReloadChats())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => scheduleReloadChats())
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${user.id}` },
          () => scheduleReloadChats(),
        )
        .subscribe();

      removeRealtime = () => {
        supabase.removeChannel(ch);
      };
    }

    void init();

    return () => {
      removeRealtime?.();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [router, scheduleReloadChats]);

  async function loadChats(userId: string) {
    const { data: dms, error: dmErr } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (dmErr) console.error('DM load error:', dmErr);

    const otherIds = new Set<string>();
    (dms || []).forEach((msg: any) => {
      otherIds.add(msg.sender_id === userId ? msg.receiver_id : msg.sender_id);
    });

    let profileMap: Record<string, any> = {};
    if (otherIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', Array.from(otherIds));
      (profiles || []).forEach((p: any) => {
        let avatarUrl = p.avatar_url;
        if (avatarUrl && !avatarUrl.startsWith('http')) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
          avatarUrl = data.publicUrl;
        }
        profileMap[p.id] = { ...p, avatar_url: avatarUrl };
      });
    }

    const convos = new Map<string, ChatItem>();
    const unread: Record<string, number> = {};
    (dms || []).forEach((msg: any) => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const other = profileMap[otherId];
      if (msg.receiver_id === userId && msg.read !== true) unread[otherId] = (unread[otherId] || 0) + 1;
      if (!convos.has(otherId)) {
        convos.set(otherId, {
          id: otherId,
          name: other?.name || 'Unknown',
          avatar: other?.avatar_url || null,
          lastMessage: previewFromMessageRow(msg),
          time: msg.created_at,
          type: 'direct',
          unreadCount: 0,
        });
      }
    });

    const directChats = Array.from(convos.values())
      .filter((c) => Boolean(profileMap[c.id]))
      .map((c) => ({ ...c, unreadCount: unread[c.id] || 0 }));

    let { data: partRows, error: partErr } = await supabase
      .from('chat_participants')
      .select('group_id, last_read_at')
      .eq('user_id', userId);

    if (partErr) console.error('chat_participants load error:', partErr);

    const hasWholeOrg = (partRows || []).some((r: { group_id: string }) => String(r.group_id) === WHOLE_ORG_CHAT_GROUP_ID);
    if (!hasWholeOrg) {
      await supabase.rpc('ensure_default_chat_memberships');
      const again = await supabase.from('chat_participants').select('group_id, last_read_at').eq('user_id', userId);
      if (!again.error) partRows = again.data;
    }

    const groupIds = [...new Set((partRows || []).map((r: { group_id: string }) => String(r.group_id)))];
    const groupMeta: Record<string, { id: string; name: string; chat_type: string | null; committee_id: string | null }> = {};
    if (groupIds.length > 0) {
      const { data: groups, error: gErr } = await supabase
        .from('chat_groups')
        .select('id, name, chat_type, committee_id')
        .in('id', groupIds);
      if (gErr) console.error('chat_groups load error:', gErr);
      for (const g of groups || []) {
        groupMeta[String((g as { id: string }).id)] = g as { id: string; name: string; chat_type: string | null; committee_id: string | null };
      }
    }

    type GroupChatRow = {
      last_read_at: string | null;
      group: { id: string; name: string; chat_type: string | null; committee_id: string | null };
    };

    const groupRows: GroupChatRow[] = [];
    for (const r of partRows || []) {
      const group = groupMeta[String((r as { group_id: string }).group_id)];
      if (group) {
        groupRows.push({ last_read_at: (r as { last_read_at: string | null }).last_read_at, group });
      }
    }

    const messageChannelIds = [...new Set(groupRows.map((r) => groupMessagesChannelId(r.group)))];
    const latestByChannel: Record<string, { message: string; created_at: string }> = {};
    if (messageChannelIds.length > 0) {
      const { data: gmRows } = await supabase
        .from('group_messages')
        .select('group_id, message, created_at, file_url, poll_data')
        .in('group_id', messageChannelIds)
        .order('created_at', { ascending: false });
      for (const row of gmRows || []) {
        const key = String((row as { group_id: string }).group_id);
        if (!latestByChannel[key]) {
          latestByChannel[key] = {
            message: previewFromMessageRow(row as { message?: string | null; file_url?: string | null; poll_data?: unknown }),
            created_at: (row as { created_at: string }).created_at,
          };
        }
      }
    }

    const unreadByChannel: Record<string, number> = {};
    await Promise.all(
      groupRows.map(async (r) => {
        const chId = groupMessagesChannelId(r.group);
        const lr = r.last_read_at || '1970-01-01T00:00:00.000Z';
        const { count } = await supabase
          .from('group_messages')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', chId)
          .neq('sender_id', userId)
          .gt('created_at', lr);
        unreadByChannel[chId] = count ?? 0;
      }),
    );

    const groupChats: ChatItem[] = groupRows.map((r) => {
      const chId = groupMessagesChannelId(r.group);
      const latest = latestByChannel[chId];
      return {
        id: chId,
        participantGroupId: String(r.group.id),
        groupChatType: r.group.chat_type,
        name: displayGroupName(r.group),
        avatar: null,
        lastMessage: latest?.message ?? 'No messages yet',
        time: latest?.created_at ?? new Date().toISOString(),
        type: 'group' as const,
        unreadCount: unreadByChannel[chId] ?? 0,
      };
    });

    setChats((prev) => {
      const newChats = [...directChats, ...groupChats];
      const orgName = 'IIChE AVVU SC';
      const ecName = 'Executive Committee';
      newChats.sort((a, b) => {
        if (a.type === 'group' && a.name === orgName && !(b.type === 'group' && b.name === orgName)) return -1;
        if (b.type === 'group' && b.name === orgName && !(a.type === 'group' && a.name === orgName)) return 1;
        if (a.type === 'group' && a.name === ecName && !(b.type === 'group' && b.name === ecName) && !(b.type === 'group' && b.name === orgName)) return -1;
        if (b.type === 'group' && b.name === ecName && !(a.type === 'group' && a.name === ecName) && !(a.type === 'group' && a.name === orgName)) return 1;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });
      const active = activeChatRef.current;
      if (active && !newChats.find((c) => c.id === active.id && c.type === active.type)) {
        const existing = prev.find((c) => c.id === active.id && c.type === active.type);
        const orphanDirect = existing?.type === 'direct' && !profileMap[active.id];
        if (existing && !orphanDirect) newChats.unshift(existing);
      }
      return newChats;
    });

    setActiveChat((prev) => {
      if (prev?.type === 'direct' && !profileMap[prev.id]) return null;
      return prev;
    });
  }

  async function openChat(chat: ChatItem) {
    setActiveChat(chat);
    setShowProfile(false);
    syncChatUrl(chat);

    let uid = currentUser?.id ?? userIdRef.current;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id ?? null;
    }
    if (!uid) return;

    if (chat.type === 'direct') {
      const { error } = await supabase
        .from('direct_messages')
        .update({ read: true } as any)
        .eq('receiver_id', uid)
        .eq('sender_id', chat.id);
      if (error) console.error('DM mark read:', error);
      setChats((prev) => prev.map((c) => (c.id === chat.id && c.type === 'direct' ? { ...c, unreadCount: 0 } : c)));
    }

    if (chat.type === 'group' && chat.participantGroupId) {
      const ts = new Date().toISOString();
      const { data, error } = await supabase
        .from('chat_participants')
        .update({ last_read_at: ts })
        .eq('group_id', chat.participantGroupId)
        .eq('user_id', uid)
        .select('group_id');
      if (error) console.error('last_read_at update:', error);
      else if (data?.length) {
        setChats((prev) =>
          prev.map((c) =>
            c.type === 'group' && c.participantGroupId === chat.participantGroupId ? { ...c, unreadCount: 0 } : c,
          ),
        );
      }
    }
  }

  function startNewChat(user: UserProfile) {
    const existing = chats.find((c) => c.type === 'direct' && c.id === user.id);
    if (existing) {
      void openChat(existing);
      return;
    }
    const newChat: ChatItem = {
      id: user.id,
      name: user.name,
      avatar: user.avatar_url,
      lastMessage: '',
      time: new Date().toISOString(),
      type: 'direct',
      unreadCount: 0,
    };
    setChats((prev) => [newChat, ...prev]);
    void openChat(newChat);
  }

  async function createGroup(name: string, description: string, memberIds: string[]) {
    if (!currentUser) return;
    try {
      const { data: group, error } = await supabase
        .from('chat_groups')
        .insert({
          name,
          description: description || null,
          chat_type: 'custom_group',
          created_by: currentUser.id,
        })
        .select()
        .single();
      if (error) throw error;

      const participants = [currentUser.id, ...memberIds].map((uid) => ({
        group_id: group.id,
        user_id: uid,
        is_admin: uid === currentUser.id,
      }));
      await supabase.from('chat_participants').insert(participants);

      const newChat: ChatItem = {
        id: String(group.id),
        participantGroupId: String(group.id),
        groupChatType: 'custom_group',
        name,
        avatar: null,
        lastMessage: 'Group created',
        time: new Date().toISOString(),
        type: 'group',
        unreadCount: 0,
      };
      setChats((prev) => [newChat, ...prev]);
      void openChat(newChat);
      toast.success('Group created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group');
    }
  }

  async function openProfile(userId: string) {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!prof) return;
    const { data: mem } = await supabase
      .from('committee_members')
      .select('position, committees(name)')
      .eq('user_id', userId)
      .neq('committee_id', '00000000-0000-0000-0000-000000000001')
      .limit(1)
      .single();
    setProfileUser({
      ...prof,
      committee_name: (mem as any)?.committees?.name || null,
      committee_position: mem?.position || null,
    });
    setShowProfile(true);
  }

  const refreshChats = useCallback(() => {
    scheduleReloadChats();
  }, [scheduleReloadChats]);

  useEffect(() => {
    if (loading || !currentUser) return;

    const userParam = searchParams.get('user');
    const groupParam = searchParams.get('group');
    const key = userParam ? `u:${userParam}` : groupParam ? `g:${groupParam}` : null;
    if (!key) return;

    if (activeChat && ((userParam && activeChat.type === 'direct' && activeChat.id === userParam) || (groupParam && activeChat.type === 'group' && activeChat.id === groupParam))) {
      deepLinkRef.current = key;
      return;
    }
    if (deepLinkRef.current === key) return;

    if (userParam) {
      const existing = chats.find((c) => c.type === 'direct' && c.id === userParam);
      if (existing) {
        deepLinkRef.current = key;
        void openChat(existing);
        return;
      }
      const user = allUsers.find((u) => u.id === userParam);
      if (user) {
        deepLinkRef.current = key;
        startNewChat(user);
      }
      return;
    }

    if (groupParam) {
      const existing = chats.find((c) => c.type === 'group' && c.id === groupParam);
      if (existing) {
        deepLinkRef.current = key;
        void openChat(existing);
      }
    }
  }, [loading, currentUser, chats, allUsers, searchParams, activeChat]);

  function handleBackFromChat() {
    setActiveChat(null);
    syncChatUrl(null);
  }

  if (loading) {
    return <PortalLoadingScreen message="Loading chats…" />;
  }

  return (
    <div className="h-[100dvh] flex bg-[#f0f2f5] overflow-hidden supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]">
      <div className={`${activeChat ? 'hidden sm:flex' : 'flex'} flex-col sm:w-[420px] sm:min-w-[320px] w-full min-h-0`}>
        <ChatSidebar
          chats={chats}
          allUsers={allUsers}
          activeChat={activeChat}
          onlineUsers={onlineUserIds}
          showOnlinePresence={showOnlinePresence}
          onSelectChat={(c) => void openChat(c)}
          onNewChat={startNewChat}
          onCreateGroup={createGroup}
          onBack={() => router.push('/dashboard')}
        />
      </div>

      <div className={`flex-1 flex min-w-0 min-h-0 ${activeChat ? 'flex' : 'hidden sm:flex'}`}>
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            currentUser={currentUser!}
            allUsers={allUsers}
            onlineUsers={onlineUserIds}
            showOnlinePresence={showOnlinePresence}
            onOpenProfile={openProfile}
            onMessageSent={refreshChats}
            onBack={handleBackFromChat}
          />
        ) : (
          <div className="flex-1 bg-[#e5ddd5] flex flex-col items-center justify-center px-6">
            <div className="text-center max-w-md">
              <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-white/80 shadow-sm flex items-center justify-center">
                <MessageSquare className="w-14 h-14 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">IIChE Chat</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Send direct messages, join group chats, share files and polls. Pick a conversation or start a new one.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showProfile && profileUser && (
            <ProfilePanel
              user={profileUser}
              isOnline={showOnlinePresence && onlineUserIds.has(profileUser.id)}
              onClose={() => setShowProfile(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<PortalLoadingScreen message="Loading chats…" />}>
      <ChatPageInner />
    </Suspense>
  );
}
