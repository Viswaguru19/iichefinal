'use client';

import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChatButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/dashboard/chat?user=${encodeURIComponent(userId)}`)}
      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 transition font-semibold text-sm"
    >
      <MessageSquare className="w-4 h-4" />
      Chat
    </button>
  );
}
