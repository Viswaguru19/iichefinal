'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Bot } from 'lucide-react';
import toast from 'react-hot-toast';

function MessagesContent() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const receiverId = searchParams.get('user');
  const receiverName = searchParams.get('name');

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, loadMessages)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [receiverId]);

  const loadMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setCurrentUser(profile);

    if (receiverId) {
      const { data } = await supabase
        .from('direct_messages')
        .select('*, sender:profiles!direct_messages_sender_id_fkey(name), receiver:profiles!direct_messages_receiver_id_fkey(name)')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      setMessages(data || []);
    }
    setLoading(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !receiverId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase as any).from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      message: newMessage,
    });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
      loadMessages();
    }
  };

  const askAI = async () => {
    if (!newMessage.trim()) {
      toast.error('Type a question first');
      return;
    }

    setShowAI(true);
    const userQuestion = newMessage;
    setNewMessage('');

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userQuestion }),
      });

      const data = await response.json();
      
      toast.success('AI Response: ' + data.reply, { duration: 5000 });
    } catch (error) {
      toast.error('AI failed to respond');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Messages</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg h-[600px] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Chat with {receiverName}</h2>
            <button onClick={askAI} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Ask AI
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-lg ${msg.sender_id === currentUser?.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
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
              placeholder="Type a message or question for AI..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
