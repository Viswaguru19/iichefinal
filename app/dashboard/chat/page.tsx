'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import ProfilePanel from '@/components/chat/ProfilePanel';
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  /** chat_groups.id — use for chat_participants.last_read_at (differs from id for committee chats where id is committee_id) */
  participantGroupId?: string;
  /** chat_groups.chat_type — set for group rows */
  groupChatType?: string | null;
}

/** Fixed UUID from migration 031 — Whole Organization group */
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

export default function ChatPage() {
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

    const { error: ensureErr } = await supabase.rpc('ensure_default_chat_memberships');
    if (ensureErr) {
      console.warn('ensure_default_chat_memberships:', ensureErr.message);
    }

    await loadChats(user.id);
    setLoading(false);
    setupRealtime(user.id);
  }

  async function loadChats(userId: string) {
    // Direct messages — fetch without profile joins (they fail)
    const { data: dms, error: dmErr } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (dmErr) console.error('DM load error:', dmErr);

    // Collect unique other-user IDs
    const otherIds = new Set<string>();
    (dms || []).forEach((msg: any) => {
      otherIds.add(msg.sender_id === userId ? msg.receiver_id : msg.sender_id);
    });

    // Fetch profiles for those users
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

    // Build conversation list
    const convos = new Map<string, ChatItem>();
    const unread: Record<string, number> = {};
    (dms || []).forEach((msg: any) => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const other = profileMap[otherId];
      if (msg.receiver_id === userId && msg.read !== true) unread[otherId] = (unread[otherId] || 0) + 1;
      if (!convos.has(otherId)) {
        convos.set(otherId, {
          id: otherId, name: other?.name || 'Unknown', avatar: other?.avatar_url || null,
          lastMessage: previewFromMessageRow(msg), time: msg.created_at, type: 'direct', unreadCount: 0,
        });
      }
    });
    // Drop DMs where the other person no longer has a profile (deleted / invalid user)
    const directChats = Array.from(convos.values())
      .filter((c) => Boolean(profileMap[c.id]))
      .map((c) => ({ ...c, unreadCount: unread[c.id] || 0 }));

    // Group membership (avoid PostgREST embed alias — it often returns null and drops every group)
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

    const groupRows = (partRows || [])
      .map((r: { group_id: string; last_read_at: string | null }) => ({
        last_read_at: r.last_read_at,
        group: groupMeta[String(r.group_id)],
      }))
      .filter((r): r is { last_read_at: string | null; group: { id: string; name: string; chat_type: string | null; committee_id: string | null } } => Boolean(r.group));

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
      const activeId = activeChat?.id;
      const activeType = activeChat?.type;
      if (activeId && activeType && !newChats.find((c) => c.id === activeId && c.type === activeType)) {
        const existing = prev.find((c) => c.id === activeId && c.type === activeType);
        const orphanDirect = existing?.type === 'direct' && !profileMap[activeId];
        if (existing && !orphanDirect) newChats.unshift(existing);
      }
      return newChats;
    });

    setActiveChat((prev) => {
      if (prev?.type === 'direct' && !profileMap[prev.id]) return null;
      return prev;
    });
  }

  function setupRealtime(userId: string) {
    const ch = supabase
      .channel('chat-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => loadChats(userId))
      // Mark-as-read uses UPDATE; without this, sidebar badges stay wrong until a new message arrives
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, () => loadChats(userId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => loadChats(userId))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${userId}`,
      }, () => loadChats(userId))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }

  async function openChat(chat: ChatItem) {
    setActiveChat(chat);
    setShowProfile(false);
    let uid = currentUser?.id ?? null;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id ?? null;
    }
    if (!uid) return;
    if (chat.type === 'direct') {
      const { data, error } = await supabase
        .from('direct_messages')
        .update({ read: true } as any)
        .eq('receiver_id', uid)
        .eq('sender_id', chat.id)
        .select('id');
      if (error) console.error('DM mark read:', error);
      else if (!data?.length && chat.unreadCount > 0) console.warn('DM mark read affected 0 rows for unread chat', chat.id);
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
    await loadChats(uid);
  }

  function startNewChat(user: UserProfile) {
    const existing = chats.find(c => c.type === 'direct' && c.id === user.id);
    if (existing) { void openChat(existing); return; }
    const newChat: ChatItem = { id: user.id, name: user.name, avatar: user.avatar_url, lastMessage: '', time: new Date().toISOString(), type: 'direct', unreadCount: 0 };
    setChats(prev => [newChat, ...prev]);
    void openChat(newChat);
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
      setChats(prev => [newChat, ...prev]);
      void openChat(newChat);
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
      {/* Sidebar — full width on mobile, fixed width on desktop. Hidden on mobile when chat is active */}
      <div className={`${activeChat ? 'hidden sm:flex' : 'flex'} flex-col sm:w-[420px] sm:min-w-[320px] w-full`}>
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

      {/* Chat Window or Empty State — hidden on mobile when no chat active */}
      <div className={`flex-1 flex ${activeChat ? 'flex' : 'hidden sm:flex'}`}>
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            currentUser={currentUser!}
            onlineUsers={onlineUserIds}
            showOnlinePresence={showOnlinePresence}
            onOpenProfile={openProfile}
            onMessageSent={refreshChats}
            onBack={() => setActiveChat(null)}
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
            <ProfilePanel user={profileUser} isOnline={showOnlinePresence && onlineUserIds.has(profileUser.id)} onClose={() => setShowProfile(false)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
