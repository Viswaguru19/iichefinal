'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { MessageSquare, Users, Search } from 'lucide-react';

export default function ChatPage() {
  const [chats, setChats] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
    
    const channel = supabase
      .channel('chat-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages' }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setCurrentUser(profile);

    // Get direct messages
    const { data: directMessages } = await supabase
      .from('direct_messages')
      .select('*, sender:profiles!direct_messages_sender_id_fkey(name, avatar_url), receiver:profiles!direct_messages_receiver_id_fkey(name, avatar_url)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Group by conversation
    const conversations = new Map();
    directMessages?.forEach((msg: any) => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const otherUser = msg.sender_id === user.id ? msg.receiver : msg.sender;
      
      if (!conversations.has(otherId)) {
        conversations.set(otherId, {
          id: otherId,
          name: otherUser.name,
          avatar: otherUser.avatar_url,
          lastMessage: msg.message,
          time: msg.created_at,
          unread: msg.receiver_id === user.id && !msg.read,
          type: 'direct'
        });
      }
    });

    // Get user's committees for group chats
    const { data: userCommittees } = await supabase
      .from('committee_members')
      .select('committee_id, committees(name)')
      .eq('user_id', user.id);

    const committeeChats = userCommittees?.map((c: any) => ({
      id: c.committee_id,
      name: c.committees.name,
      type: 'group',
      lastMessage: 'Group chat',
      time: new Date().toISOString()
    })) || [];

    // Add IIChE main group
    committeeChats.unshift({
      id: 'iiche-main',
      name: 'IIChE AVVU',
      type: 'group',
      lastMessage: 'Main group chat',
      time: new Date().toISOString()
    });

    setChats([...Array.from(conversations.values()), ...committeeChats]);
  }

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Chats</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="divide-y">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => {
                  if (chat.type === 'direct') {
                    router.push(`/dashboard/messages?user=${chat.id}&name=${chat.name}`);
                  } else {
                    router.push(`/dashboard/chat/group?id=${chat.id}&name=${chat.name}`);
                  }
                }}
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4"
              >
                <div className="relative">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${chat.type === 'group' ? 'bg-green-600' : 'bg-blue-600'}`}>
                      {chat.type === 'group' ? <Users className="w-6 h-6" /> : chat.name.charAt(0)}
                    </div>
                  )}
                  {chat.unread && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">
                      1
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 truncate">{chat.name}</h3>
                    <span className="text-xs text-gray-500">
                      {new Date(chat.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
                </div>
              </div>
            ))}

            {filteredChats.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No chats yet. Start a conversation!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
