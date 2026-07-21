'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import toast from 'react-hot-toast';

type PushUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  pushDevices: number;
  hasPush: boolean;
};

export default function TestPushNotificationCard() {
  const [users, setUsers] = useState<PushUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void fetch('/api/push/test')
      .then((r) => r.json())
      .then((data: { users?: PushUser[]; error?: string }) => {
        if (data.error) toast.error(data.error);
        else setUsers(data.users || []);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoadingUsers(false));
  }, []);

  const selected = users.find((u) => u.id === userId);

  async function handleSend() {
    if (!userId) {
      toast.error('Select a user');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send test notification', { duration: 6000 });
        return;
      }
      toast.success(data.message || 'Test notification sent');
    } catch {
      toast.error('Failed to send test notification');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="premium-panel rounded-2xl p-6">
      <h2 className="text-xl font-bold text-gradient mb-2 flex items-center gap-2">
        <BellRing className="w-5 h-5" /> Test App Notification
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Send a test push to a user&apos;s phone. They must tap <strong>Enable notifications</strong> in Profile
        (Android: Chrome/Edge · iPhone: Home Screen app first).
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">User</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={loadingUsers || sending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">{loadingUsers ? 'Loading users…' : 'Select a user'}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email || u.id}
                {u.hasPush ? ` ✓ (${u.pushDevices} device${u.pushDevices === 1 ? '' : 's'})` : ' — not enabled'}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <p
            className={`text-xs rounded-lg px-3 py-2 ${selected.hasPush ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}
          >
            {selected.hasPush
              ? `${selected.name || selected.email} has notifications enabled on ${selected.pushDevices} device(s).`
              : `${selected.name || selected.email} has not enabled notifications yet — ask them to open Profile → Enable notifications.`}
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Message (optional)</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Custom test message…"
            disabled={sending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !userId || loadingUsers}
          className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <BellRing className="w-4 h-4" />
              Send test notification
            </>
          )}
        </button>
      </div>
    </div>
  );
}
