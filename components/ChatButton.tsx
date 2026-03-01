'use client';

import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChatButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();

  const handleChat = () => {
    router.push(`/dashboard/messages?user=${userId}&name=${userName}`);
  };

  return (
    <button
      onClick={handleChat}
      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition"
    >
      <MessageSquare className="w-4 h-4" />
      Chat
    </button>
  );
}
