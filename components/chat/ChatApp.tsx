'use client';

import PortalLoadingScreen from '@/components/PortalLoadingScreen';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import ProfilePanel from '@/components/chat/ProfilePanel';
import InstallChatAppPrompt from '@/components/chat/InstallChatAppPrompt';
import DynamicLogo from '@/components/DynamicLogo';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { groupMessagesChannelId } from '@/lib/chat-group-keys';
import {
  CHAT_OFFICIAL_GROUP_ID,
  CHAT_UNOFFICIAL_GROUP_ID,
  LEGACY_UNOFFICIAL_GROUP_ID,
  WHOLE_ORG_CHAT_GROUP_ID,
} from '@/lib/chat-ids';
import { usePortalPresence } from '@/components/dashboard/PortalPresenceContext';
import type { ChatItem, UserProfile } from '@/components/chat/types';
import { chatPinKey, loadPinnedChatKeys, togglePinnedChatKey } from '@/lib/chat-pins';

export type { ChatItem, UserProfile };

const DEFAULT_BASE = '/chat';

function chatListKey(c: ChatItem) {
  if (c.type !== 'group') return `d:${c.id}`;
  if (c.groupChatType === 'unofficial' || c.name === 'Unofficial') return 'g:unofficial';
  if (c.groupChatType && !['custom_group', 'committee'].includes(c.groupChatType)) {
    return `g:${c.groupChatType}`;
  }
  return `g:${c.participantGroupId || c.id}`;
}

function dedupeChats(chats: ChatItem[]) {
  const seen = new Set<string>();
  const out: ChatItem[] = [];
  for (const c of chats) {
    const k = chatListKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function displayGroupName(g: { name?: string | null; chat_type: string | null }) {
  if (g.chat_type === 'organization') return 'Official';
  if (g.chat_type === 'unofficial') return 'Unofficial';
  if (g.chat_type === 'executive') return 'Office bearers (EC)';
  if (g.chat_type === 'heads') return 'Heads';
  if (g.chat_type === 'coheads') return 'Co-heads';
  const n = g.name?.trim();
  return n || 'Group';
}

function defaultGroupRank(c: ChatItem) {
  const t = c.groupChatType;
  if (t === 'organization') return 0;
  if (t === 'unofficial') return 1;
  if (t === 'executive') return 2;
  if (t === 'heads') return 3;
  if (t === 'coheads') return 4;
  if (t === 'committee') return 5;
  return 20;
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

function ChatAppInner({ basePath = DEFAULT_BASE, chatOnly = true }: { basePath?: string; chatOnly?: boolean }) {
  const { onlineUserIds, showOnlinePresence } = usePortalPresence();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatTheme, setChatTheme] = useState<'dark' | 'light'>('dark');
  const [pinnedKeys, setPinnedKeys] = useState<string[]>([]);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat-theme');
      if (saved === 'light' || saved === 'dark') setChatTheme(saved);
    } catch {
      // localStorage unavailable — keep default dark theme.
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    setPinnedKeys(loadPinnedChatKeys(currentUser.id));
  }, [currentUser?.id]);

  /** Lock page scroll so the chat shell owns the viewport on mobile. */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevTouch = body.style.touchAction;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'manipulation';
    html.classList.add('chat-viewport-lock');

    const syncViewportHeight = () => {
      const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
      html.style.setProperty('--chat-vvh', `${h}px`);
    };
    syncViewportHeight();
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('scroll', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);
    window.addEventListener('orientationchange', syncViewportHeight);

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.touchAction = prevTouch;
      html.classList.remove('chat-viewport-lock');
      html.style.removeProperty('--chat-vvh');
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('scroll', syncViewportHeight);
      window.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('orientationchange', syncViewportHeight);
    };
  }, []);

  const toggleChatTheme = useCallback(() => {
    setChatTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('chat-theme', next);
      } catch {
        // Ignore persistence failure; theme still switches for this session.
      }
      return next;
    });
  }, []);
  const userIdRef = useRef<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkRef = useRef<string | null>(null);
  const skipDeepLinkOpenRef = useRef(false);
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
    }, 120);
  }, []);

  /** Avoid wiping a just-cleared badge when realtime reloads race mark-as-read. */
  const clearUnreadForActive = useCallback((list: ChatItem[]) => {
    const active = activeChatRef.current;
    if (!active) return list;
    return list.map((c) =>
      c.id === active.id && c.type === active.type ? { ...c, unreadCount: 0 } : c,
    );
  }, []);

  const syncChatUrl = useCallback(
    (chat: ChatItem | null) => {
      if (typeof window === 'undefined') return;
      const next =
        !chat
          ? basePath
          : chat.type === 'direct'
            ? `${basePath}?user=${encodeURIComponent(chat.id)}`
            : `${basePath}?group=${encodeURIComponent(chat.id)}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === next) return;
      // replaceState avoids Next.js search-param navigation, which remounts this
      // screen (and wipes the message draft) via the Suspense boundary.
      window.history.replaceState(window.history.state, '', next);
    },
    [basePath],
  );

  useEffect(() => {
    let removeRealtime: (() => void) | undefined;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(basePath)}`);
        return;
      }
      userIdRef.current = user.id;

      const [{ data: profile }, { data: users }, { data: membership }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('profiles').select('*').neq('id', user.id).order('name'),
        supabase
          .from('committee_members')
          .select('position, committees(name)')
          .eq('user_id', user.id)
          .neq('committee_id', '00000000-0000-0000-0000-000000000001')
          .limit(1)
          .maybeSingle(),
      ]);
      if (!profile) return;

      const currentProfile: UserProfile = {
        ...profile,
        committee_name: (membership as any)?.committees?.name || null,
        committee_position: membership?.position || null,
      };
      setCurrentUser(currentProfile);

      const usersWithAvatars = (users || []).map((u: any) => {
        if (u.avatar_url && !u.avatar_url.startsWith('http')) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(u.avatar_url);
          return { ...u, avatar_url: data.publicUrl };
        }
        return u;
      });
      setAllUsers(usersWithAvatars);
      // Show the chat shell immediately; load conversation list in parallel.
      setLoading(false);

      void (async () => {
        const { error: ensureErr } = await supabase.rpc('ensure_default_chat_memberships');
        if (ensureErr) console.warn('ensure_default_chat_memberships:', ensureErr.message);
        await loadChats(user.id);
      })();

      const ch = supabase
        .channel('chat-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => scheduleReloadChats())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => scheduleReloadChats())
        .subscribe();

      // Fallback: refresh the list on an interval in case DB realtime is unavailable.
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') void loadChats(user.id);
      }, 20000);

      removeRealtime = () => {
        supabase.removeChannel(ch);
      };
    }

    let pollTimer: number | undefined;
    void init();

    return () => {
      removeRealtime?.();
      if (pollTimer) window.clearInterval(pollTimer);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [router, scheduleReloadChats, basePath]);

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
      const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', Array.from(otherIds));
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

    partRows = (partRows || []).filter(
      (r: { group_id: string }) => String(r.group_id) !== LEGACY_UNOFFICIAL_GROUP_ID,
    );
    const groupIds = [...new Set((partRows || []).map((r: { group_id: string }) => String(r.group_id)))];
    const groupMeta: Record<
      string,
      {
        id: string;
        name: string;
        chat_type: string | null;
        committee_id: string | null;
        avatar_url?: string | null;
        description?: string | null;
      }
    > = {};
    if (groupIds.length > 0) {
      const { data: groups, error: gErr } = await supabase
        .from('chat_groups')
        .select('id, name, chat_type, committee_id, avatar_url, description')
        .in('id', groupIds);
      if (gErr) console.error('chat_groups load error:', gErr);
      for (const g of groups || []) {
        groupMeta[String((g as { id: string }).id)] = g as {
          id: string;
          name: string;
          chat_type: string | null;
          committee_id: string | null;
          avatar_url?: string | null;
          description?: string | null;
        };
      }
    }

    type GroupChatRow = {
      last_read_at: string | null;
      group: {
        id: string;
        name: string;
        chat_type: string | null;
        committee_id: string | null;
        avatar_url?: string | null;
        description?: string | null;
      };
    };

    const groupRows: GroupChatRow[] = [];
    const seenGroups = new Set<string>();
    for (const r of partRows || []) {
      const group = groupMeta[String((r as { group_id: string }).group_id)];
      if (!group) continue;
      const gid = String(group.id);
      if (seenGroups.has(gid)) continue;
      seenGroups.add(gid);
      groupRows.push({ last_read_at: (r as { last_read_at: string | null }).last_read_at, group });
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

    const groupChats: ChatItem[] = dedupeChats(
      groupRows.map((r) => {
        const isUnofficial = r.group.chat_type === 'unofficial';
        const chId = isUnofficial ? CHAT_UNOFFICIAL_GROUP_ID : groupMessagesChannelId(r.group);
        const latest = latestByChannel[groupMessagesChannelId(r.group)] || latestByChannel[chId];
        return {
          id: chId,
          participantGroupId: isUnofficial ? CHAT_UNOFFICIAL_GROUP_ID : String(r.group.id),
          groupChatType: r.group.chat_type,
          name: displayGroupName(r.group),
          avatar: r.group.avatar_url || null,
          description: r.group.description || null,
          lastMessage: latest?.message ?? 'No messages yet',
          time: latest?.created_at ?? '',
          type: 'group' as const,
          unreadCount: unreadByChannel[chId] ?? unreadByChannel[groupMessagesChannelId(r.group)] ?? 0,
        };
      }),
    );

    setChats((prev) => {
      const newChats = dedupeChats([...directChats, ...groupChats]);
      newChats.sort((a, b) => {
        const tb = new Date(b.time || 0).getTime();
        const ta = new Date(a.time || 0).getTime();
        if (tb !== ta) return tb - ta;
        return defaultGroupRank(a) - defaultGroupRank(b);
      });
      const active = activeChatRef.current;
      if (active?.type === 'direct' && !newChats.find((c) => c.id === active.id && c.type === 'direct')) {
        const existing = prev.find((c) => c.id === active.id && c.type === 'direct') || active;
        newChats.unshift(existing);
      }
      return clearUnreadForActive(newChats);
    });

    setActiveChat((prev) => {
      if (!prev) return prev;
      if (prev.unreadCount) return { ...prev, unreadCount: 0 };
      return prev;
    });
  }

  async function markConversationSeen(chat: ChatItem, uid: string) {
    // Clear sidebar badge immediately; persist below so reload stays clear.
    setChats((prev) =>
      prev.map((c) =>
        c.id === chat.id && c.type === chat.type ? { ...c, unreadCount: 0 } : c,
      ),
    );
    setActiveChat((prev) =>
      prev && prev.id === chat.id && prev.type === chat.type ? { ...prev, unreadCount: 0 } : prev,
    );

    if (chat.type === 'direct') {
      const { error } = await supabase
        .from('direct_messages')
        .update({ read: true } as any)
        .eq('receiver_id', uid)
        .eq('sender_id', chat.id);
      if (error) console.error('DM mark read:', error);

      // Clear portal notification badges for this DM thread
      const { error: notifErr } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', uid)
        .in('type', ['chat', 'message'])
        .or(`link.ilike.%user=${chat.id}%,link.ilike.%user%3D${chat.id}%`);
      if (notifErr) console.error('Chat notification mark read:', notifErr);
    }

    if (chat.type === 'group' && chat.participantGroupId) {
      const ts = new Date().toISOString();
      const { error } = await supabase
        .from('chat_participants')
        .update({ last_read_at: ts })
        .eq('group_id', chat.participantGroupId)
        .eq('user_id', uid);
      if (error) console.error('last_read_at update:', error);

      const groupKey = chat.id;
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', uid)
        .in('type', ['chat', 'message'])
        .or(
          `link.ilike.%group=${groupKey}%,link.ilike.%group%3D${groupKey}%,link.ilike.%id=${groupKey}%`,
        );
    }
  }

  async function openChat(chat: ChatItem) {
    skipDeepLinkOpenRef.current = false;
    const already =
      activeChatRef.current &&
      activeChatRef.current.id === chat.id &&
      activeChatRef.current.type === chat.type;
    if (!already) {
      setActiveChat({ ...chat, unreadCount: 0 });
      setShowProfile(false);
      syncChatUrl(chat);
    }

    let uid = currentUser?.id ?? userIdRef.current;
    if (!uid) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      uid = user?.id ?? null;
    }
    if (!uid) return;

    // Don't block opening the chat on mark-as-read network round-trip.
    void markConversationSeen(chat, uid);
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

  function patchActiveChat(preview?: string) {
    if (!activeChat) {
      refreshChats();
      return;
    }
    const ts = new Date().toISOString();
    setChats((prev) => {
      const next = prev.map((c) =>
        c.id === activeChat.id && c.type === activeChat.type
          ? { ...c, lastMessage: preview || c.lastMessage, time: ts, unreadCount: 0 }
          : c,
      );
      next.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return next;
    });
    setActiveChat((prev) => (prev ? { ...prev, lastMessage: preview || prev.lastMessage, time: ts, unreadCount: 0 } : prev));
  }

  async function deleteChat(chat: ChatItem) {
    const uid = currentUser?.id ?? userIdRef.current;
    if (!uid) return;

    if (chat.type === 'direct') {
      if (!confirm(`Delete chat with ${chat.name}? All messages will be removed.`)) return;
      await supabase.from('direct_messages').delete().eq('sender_id', uid).eq('receiver_id', chat.id);
      await supabase.from('direct_messages').delete().eq('sender_id', chat.id).eq('receiver_id', uid);
      setChats((prev) => prev.filter((c) => !(c.id === chat.id && c.type === 'direct')));
      if (activeChat?.id === chat.id && activeChat.type === 'direct') {
        skipDeepLinkOpenRef.current = true;
        deepLinkRef.current = null;
        setActiveChat(null);
        syncChatUrl(null);
      }
      toast.success('Chat deleted');
      return;
    }

    if (chat.participantGroupId) {
      if (chat.groupChatType === 'custom_group') {
        if (!confirm(`Leave / remove "${chat.name}" from your list?`)) return;
        await supabase.from('chat_participants').delete().eq('group_id', chat.participantGroupId).eq('user_id', uid);
      } else {
        toast.error('Organization chats stay in your list');
        return;
      }
      setChats((prev) => prev.filter((c) => !(c.id === chat.id && c.type === 'group')));
      if (activeChat?.id === chat.id && activeChat.type === 'group') {
        skipDeepLinkOpenRef.current = true;
        deepLinkRef.current = null;
        setActiveChat(null);
        syncChatUrl(null);
      }
      toast.success('Removed from chats');
    }
  }

  function applyChatMeta(patch: Partial<ChatItem>) {
    setActiveChat((prev) => (prev ? { ...prev, ...patch } : prev));
    setChats((prev) =>
      prev.map((c) => (activeChat && c.id === activeChat.id && c.type === activeChat.type ? { ...c, ...patch } : c)),
    );
  }

  useEffect(() => {
    if (loading || !currentUser || skipDeepLinkOpenRef.current) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    const groupParam = params.get('group');
    const key = userParam ? `u:${userParam}` : groupParam ? `g:${groupParam}` : null;
    if (!key) return;

    const active = activeChatRef.current;
    if (
      active &&
      ((userParam && active.type === 'direct' && active.id === userParam) ||
        (groupParam &&
          active.type === 'group' &&
          (active.id === groupParam || active.participantGroupId === groupParam)))
    ) {
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
      const resolvedParam =
        groupParam === LEGACY_UNOFFICIAL_GROUP_ID ? CHAT_UNOFFICIAL_GROUP_ID : groupParam;
      const existing = chats.find(
        (c) =>
          c.type === 'group' &&
          (c.id === resolvedParam ||
            c.participantGroupId === resolvedParam ||
            c.id === groupParam ||
            c.participantGroupId === groupParam),
      );
      if (existing) {
        deepLinkRef.current = key;
        void openChat(existing);
      }
    }
  }, [loading, currentUser, chats, allUsers]);

  function handleBackFromChat() {
    skipDeepLinkOpenRef.current = true;
    deepLinkRef.current = null;
    setActiveChat(null);
    syncChatUrl(null);
  }

  function togglePinChat(chat: ChatItem) {
    if (!currentUser?.id) return;
    const key = chatPinKey(chat.type, chat.id);
    const next = togglePinnedChatKey(currentUser.id, key);
    setPinnedKeys(next);
  }

  const sortedChats = dedupeChats([...chats]).sort((a, b) => {
    const aPin = pinnedKeys.includes(chatPinKey(a.type, a.id));
    const bPin = pinnedKeys.includes(chatPinKey(b.type, b.id));
    if (aPin !== bPin) return aPin ? -1 : 1;
    const tb = new Date(b.time || 0).getTime();
    const ta = new Date(a.time || 0).getTime();
    if (tb !== ta) return tb - ta;
    return defaultGroupRank(a) - defaultGroupRank(b);
  });

  if (loading) {
    return <PortalLoadingScreen message="Loading chats…" variant="community" />;
  }

  return (
    <div
      data-chat-theme={chatTheme}
      className="chat-shell chat-theme-iiche fixed inset-0 z-40 flex w-full bg-[#0b141a] overflow-hidden overscroll-none"
    >
      <div className="chat-aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      {/* Chat list — full screen on phone until a conversation is open */}
      <div
        className={`${
          activeChat ? 'hidden md:flex' : 'flex'
        } flex-col md:w-[420px] md:min-w-[320px] w-full min-h-0 h-full overflow-hidden`}
      >
        <ChatSidebar
          chats={sortedChats}
          allUsers={allUsers}
          activeChat={activeChat}
          onlineUsers={onlineUserIds}
          showOnlinePresence={showOnlinePresence}
          pinnedKeys={pinnedKeys}
          onSelectChat={(c) => void openChat(c)}
          onNewChat={startNewChat}
          onCreateGroup={createGroup}
          onDeleteChat={(c) => void deleteChat(c)}
          onTogglePin={togglePinChat}
          onBack={() => router.push('/dashboard')}
          chatOnly={chatOnly}
          onOpenPortal={chatOnly ? () => router.push('/dashboard') : undefined}
          theme={chatTheme}
          onToggleTheme={toggleChatTheme}
        />
      </div>

      {/* Open conversation — absolute full-bleed on phone so it always fits */}
      <div
        className={`${
          activeChat
            ? 'absolute inset-0 z-10 flex md:static md:z-auto md:flex-1'
            : 'hidden md:flex md:flex-1'
        } min-w-0 min-h-0 h-full overflow-hidden`}
      >
        {activeChat ? (
          <div className="flex-1 flex min-h-0 min-w-0 h-full chat-pane-in">
            <ChatWindow
              chat={activeChat}
              currentUser={currentUser!}
              allUsers={allUsers}
              onlineUsers={onlineUserIds}
              showOnlinePresence={showOnlinePresence}
              onOpenProfile={openProfile}
              onMessageSent={patchActiveChat}
              onBack={handleBackFromChat}
              onChatMetaUpdate={applyChatMeta}
              onLeaveOrDeleteChat={() => {
                if (!activeChat) return;
                skipDeepLinkOpenRef.current = true;
                deepLinkRef.current = null;
                setChats((prev) => prev.filter((c) => !(c.id === activeChat.id && c.type === activeChat.type)));
                setActiveChat(null);
                syncChatUrl(null);
              }}
            />
          </div>
        ) : (
          <div className="flex-1 bg-transparent flex flex-col items-center justify-center px-6 relative overflow-hidden">
            <div className="text-center max-w-md relative z-10">
              <div className="relative w-32 h-32 mx-auto mb-7">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/40 via-violet-500/20 to-cyan-400/30 blur-xl chat-logo-breathe" />
                <div className="relative w-28 h-28 mx-auto mt-2 rounded-full bg-[#202c33]/80 backdrop-blur-md flex items-center justify-center overflow-hidden ring-2 ring-indigo-400/40 shadow-[0_0_40px_rgba(99,102,241,0.35)]">
                  <DynamicLogo width={88} height={88} />
                </div>
              </div>
              <h2 className="text-2xl font-semibold bg-gradient-to-r from-white via-indigo-100 to-cyan-200 bg-clip-text text-transparent mb-2 tracking-tight">
                IIChE Chat
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Official chapter messaging — groups, files, polls, and read receipts for portal members.
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

      {chatOnly && !activeChat && <InstallChatAppPrompt />}
    </div>
  );
}

export default function ChatApp({ basePath = DEFAULT_BASE, chatOnly = true }: { basePath?: string; chatOnly?: boolean }) {
  return <ChatAppInner basePath={basePath} chatOnly={chatOnly} />;
}
