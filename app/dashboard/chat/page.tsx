'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { MessageSquare, Users, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const [chats, setChats] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_messages' },
        (payload) => handleRealtimeUpdate(payload, 'direct')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages' },
        (payload) => handleRealtimeUpdate(payload, 'group')
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, role')
      .eq('id', user.id)
      .single();
    setCurrentUser(profile);

    // Get direct messages
    const { data: directMessages } = await supabase
      .from('direct_messages')
      .select(
        '*, sender:profiles!direct_messages_sender_id_fkey(name, avatar_url), receiver:profiles!direct_messages_receiver_id_fkey(name, avatar_url)'
      )
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Group by conversation and calculate unread counts
    const conversations = new Map<string, any>();
    const unreadCounts: Record<string, number> = {};

    directMessages?.forEach((msg: any) => {
      const otherId =
        msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const otherUser = msg.sender_id === user.id ? msg.receiver : msg.sender;

      if (msg.receiver_id === user.id && !msg.read) {
        unreadCounts[otherId] = (unreadCounts[otherId] || 0) + 1;
      }

      if (!conversations.has(otherId)) {
        conversations.set(otherId, {
          id: otherId,
          name: otherUser.name,
          avatar: otherUser.avatar_url,
          lastMessage: msg.message,
          time: msg.created_at,
          type: 'direct',
        });
      }
    });

    const directChats = Array.from(conversations.values()).map((chat) => ({
      ...chat,
      unreadCount: unreadCounts[chat.id] || 0,
    }));

    // Get user's committees for group chats
    const { data: userCommittees } = await supabase
      .from('committee_members')
      .select('committee_id, committees(name)')
      .eq('user_id', user.id);

    const committeeChats =
      userCommittees?.map((c: any) => ({
        id: c.committee_id,
        name: c.committees.name,
        type: 'group',
        lastMessage: 'Group chat',
        time: new Date().toISOString(),
        unreadCount: 0,
      })) || [];

    // Check if user is a head or co-head using new role system
    const isHead = profile?.role === 'committee_head';
    const isCoHead = profile?.role === 'committee_cohead';

    // Add special group chats
    const specialChats: any[] = [];

    // IIChE main group (everyone)
    specialChats.push({
      id: 'iiche-main',
      name: 'IIChE AVVU',
      type: 'group',
      lastMessage: 'Main group chat',
      time: new Date().toISOString(),
      unreadCount: 0,
    });

    // All Heads group (only for heads)
    if (isHead) {
      specialChats.push({
        id: 'all-heads',
        name: '👑 All Committee Heads',
        type: 'group',
        lastMessage: 'Heads discussion group',
        time: new Date().toISOString(),
        unreadCount: 0,
      });
    }

    // All Co-Heads group (only for co-heads)
    if (isCoHead) {
      specialChats.push({
        id: 'all-coheads',
        name: '⭐ All Committee Co-Heads',
        type: 'group',
        lastMessage: 'Co-Heads discussion group',
        time: new Date().toISOString(),
        unreadCount: 0,
      });
    }

    setChats([...directChats, ...specialChats, ...committeeChats]);
  }

  function handleRealtimeUpdate(payload: any, type: 'direct' | 'group') {
    // Refresh chat list
    loadData();

    if (!currentUser) return;

    if (type === 'direct') {
      const msg = payload.new as any;
      if (msg.receiver_id !== currentUser.id) return;

      const otherId =
        msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      const existingChat = chats.find(
        (c) => c.type === 'direct' && c.id === otherId
      );

      const name =
        existingChat?.name ||
        (msg.sender_id === currentUser.id
          ? msg.receiver?.name
          : msg.sender?.name) ||
        'New message';

      toast((t) => (
        <button
          onClick={() => {
            toast.dismiss(t.id);
            router.push(`/dashboard/messages?user=${otherId}&name=${name}`);
          }}
          className="flex flex-col items-start bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-left"
        >
          <span className="text-xs text-teal-300">New message</span>
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-gray-300 truncate max-w-xs">
            {msg.message}
          </span>
        </button>
      ));
    }
  }

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* WhatsApp-like header */}
      <div className="bg-teal-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <h1 className="text-xl font-semibold">Chats</h1>
        <button
          onClick={() => router.back()}
          className="text-sm px-3 py-1 rounded-full bg-teal-600 hover:bg-teal-500"
        >
          Back
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 bg-teal-800/80">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-200" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full pl-9 pr-3 py-2 rounded-full bg-teal-900/40 text-white placeholder:text-teal-200 text-sm border border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </div>

      {/* Chat list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23e5ddd5\'/%3E%3C/svg%3E")',
          backgroundSize: '300px',
        }}
      >
        <div className="divide-y divide-white/10 bg-black/10">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                if (chat.type === 'direct') {
                  router.push(
                    `/dashboard/messages?user=${chat.id}&name=${encodeURIComponent(
                      chat.name
                    )}`
                  );
                } else {
                  router.push(
                    `/dashboard/chat/group?id=${chat.id}&name=${encodeURIComponent(
                      chat.name
                    )}`
                  );
                }
              }}
              className="px-3 py-2 hover:bg-white/40 cursor-pointer flex items-center gap-3"
            >
              <div className="relative">
                {chat.avatar ? (
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                    {chat.type === 'group' ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      chat.name.charAt(0)
                    )}
                  </div>
                )}
                {chat.unreadCount > 0 && (
                  <div className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] px-1">
                    {chat.unreadCount}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 truncate text-sm">
                    {chat.name}
                  </h3>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">
                    {chat.time &&
                      new Date(chat.time).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-gray-700 truncate">
                    {chat.lastMessage}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {filteredChats.length === 0 && (
            <div className="p-8 text-center text-gray-600">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p className="text-sm">
                No chats yet. Start a conversation from the members list.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
