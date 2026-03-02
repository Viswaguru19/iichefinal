'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';

function GroupChatContent() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get('id');
  const groupName = searchParams.get('name');

  useEffect(() => {
    loadMessages();
    
    const channel = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, loadMessages)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  async function loadMessages() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !groupId) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setCurrentUser(profile);

    const { data } = await supabase
      .from('group_messages')
      .select('*, sender:profiles(name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const { error } = await (supabase as any)
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id: currentUser.id,
        message: newMessage
      });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">{groupName}</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg h-[600px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs ${msg.sender_id === currentUser?.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} rounded-lg px-4 py-2`}>
                  {msg.sender_id !== currentUser?.id && (
                    <p className="text-xs font-bold mb-1 opacity-70">{msg.sender?.name}</p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function GroupChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <GroupChatContent />
    </Suspense>
  );
}
