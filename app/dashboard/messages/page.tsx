'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Paperclip, Smile, Image as ImageIcon, ArrowLeft, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import DynamicLogo from '@/components/DynamicLogo';

function MessagesContent() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const receiverId = searchParams.get('user');
  const receiverName = searchParams.get('name');

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        if ((payload.new as any).sender_id === receiverId || (payload.new as any).receiver_id === receiverId) {
          loadMessages();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [receiverId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        .select('*, sender:profiles!direct_messages_sender_id_fkey(name, avatar_url), receiver:profiles!direct_messages_receiver_id_fkey(name, avatar_url)')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      setMessages(data || []);

      // Mark messages as read
      await (supabase as any)
        .from('direct_messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', receiverId);
    }
    setLoading(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !receiverId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    // Optimistic update - add message immediately to UI
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: receiverId,
      message: messageText,
      created_at: new Date().toISOString(),
      read: false,
      sender: currentUser,
      receiver: null
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    const { error } = await (supabase as any).from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      message: messageText,
      read: false
    });

    if (error) {
      toast.error('Failed to send message');
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(messageText);
    } else {
      // Reload to get the real message with proper ID
      loadMessages();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `chat-files/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Send message with file URL
      const messageText = `📎 ${file.name}`;
      const { error } = await (supabase as any).from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: receiverId,
        message: messageText,
        file_url: publicUrl,
        read: false
      });

      if (error) throw error;

      toast.success('File sent successfully');
      loadMessages();
    } catch (error: any) {
      toast.error('Failed to upload file: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const sendPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      toast.error('Please provide a question and at least 2 options');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !receiverId) return;

    const pollData = {
      question: pollQuestion.trim(),
      options: pollOptions.filter(o => o.trim()),
      votes: {}
    };

    const messageText = `📊 POLL: ${pollQuestion}`;
    const { error } = await (supabase as any).from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      message: messageText,
      poll_data: pollData,
      read: false
    });

    if (error) {
      toast.error('Failed to send poll');
    } else {
      toast.success('Poll sent successfully');
      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      loadMessages();
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* WhatsApp-like Header */}
      <div className="bg-teal-700 text-white p-4 flex items-center gap-3 shadow-md">
        <button onClick={() => router.back()} className="hover:bg-teal-600 p-2 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center font-bold text-lg">
          {receiverName?.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="font-semibold">{receiverName}</h2>
          <p className="text-xs text-teal-100">Online</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 relative" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M0 0h100v100H0z" fill="%23e5ddd5"/%3E%3C/svg%3E")', backgroundSize: '300px' }}>
        {/* Logo Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
          <DynamicLogo width={256} height={256} />
        </div>

        <div className="relative z-10">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="bg-white/80 inline-block px-4 py-2 rounded-lg shadow">No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isSent = msg.sender_id === currentUser?.id;
            return (
              <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-2`}>
                <div className={`max-w-[70%] px-4 py-2 rounded-lg shadow ${isSent ? 'bg-teal-100' : 'bg-white'}`}>
                  <p className="text-sm text-gray-900 break-words">{msg.message}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <p className="text-xs text-gray-500">
                      {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isSent && (
                      <span className="text-xs text-blue-600">✓✓</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="bg-gray-100 p-3 flex items-center gap-2 border-t relative">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <Smile className="w-6 h-6" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-14 left-0 bg-white rounded-xl shadow-2xl p-4 z-50 border border-gray-200 max-h-80 overflow-y-auto w-80">
              <div className="grid grid-cols-8 gap-1">
                {[
                  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
                  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
                  '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
                  '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒',
                  '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
                  '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
                  '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
                  '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶',
                  '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮',
                  '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
                  '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠',
                  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
                  '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐',
                  '🖖', '👋', '🤝', '💪', '🦾', '🙏', '✍️', '💅',
                  '🤳', '💃', '🕺', '👯', '🧘', '🛀', '🛌', '🧑',
                  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
                  '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
                  '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️',
                  '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
                  '🔥', '💯', '💢', '💥', '💫', '💦', '💨', '🕳',
                  '💬', '👁️', '🗨', '🗯', '💭', '💤', '👋', '🤚',
                  '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉',
                  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
                  '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
                  '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿'
                ].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-2xl hover:bg-gray-100 rounded p-1.5 transition-colors flex items-center justify-center"
                    onClick={() => {
                      setNewMessage((prev) => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-gray-500 hover:text-gray-700 p-2 disabled:opacity-50">
          <Paperclip className="w-6 h-6" />
        </button>
        <button type="button" onClick={() => setShowPollModal(true)} className="text-gray-500 hover:text-gray-700 p-2" title="Create Poll">
          <BarChart3 className="w-6 h-6" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message"
          className="flex-1 px-4 py-3 border-none rounded-full bg-white focus:ring-2 focus:ring-teal-500 outline-none"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="bg-teal-600 text-white p-3 rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {/* Poll Modal */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Poll</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="What's your question?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                {pollOptions.map((option, index) => (
                  <input
                    key={index}
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...pollOptions];
                      newOptions[index] = e.target.value;
                      setPollOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none mb-2"
                  />
                ))}
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    + Add Option
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={sendPoll}
                  className="flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
                >
                  Send Poll
                </button>
                <button
                  onClick={() => {
                    setShowPollModal(false);
                    setPollQuestion('');
                    setPollOptions(['', '']);
                  }}
                  className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
