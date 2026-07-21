'use client';

import { useEffect, useState } from 'react';
import { BellRing, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { describeDevice } from '@/lib/push/device-hint';

type PushUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  pushDevices: number;
  hasPush: boolean;
  pushDeviceHint?: string | null;
  pushUpdatedAt?: string | null;
};

type PushHealth = {
  ready?: boolean;
  tableOk?: boolean;
  subscriptionCount?: number;
  tableError?: string | null;
  serviceRoleKey?: boolean;
  vapidPublic?: boolean;
  vapidPrivate?: boolean;
  vapidPairOk?: boolean;
  vapidError?: string | null;
};

export default function TestPushNotificationCard() {
  const [users, setUsers] = useState<PushUser[]>([]);
  const [health, setHealth] = useState<PushHealth | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/push/health')
      .then((r) => r.json())
      .then((data: PushHealth) => setHealth(data))
      .catch(() => setHealth(null));

    void fetch('/api/push/test')
      .then((r) => r.json())
      .then((data: { users?: PushUser[]; error?: string }) => {
        if (data.error) {
          setLastError(data.error);
          toast.error(data.error, { duration: 8000 });
        } else {
          const list = data.users || [];
          setUsers(list);
          const withPush = list.filter((u) => u.hasPush);
          if (withPush.length === 1) {
            setUserId(withPush[0].id);
          }
        }
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
    setLastError(null);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || 'Failed to send test notification';
        setLastError(err);
        toast.error(err, { duration: 8000 });
        return;
      }
      toast.success(data.message || 'Test notification sent');
    } catch {
      const err = 'Network error — could not reach push API';
      setLastError(err);
      toast.error(err);
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

      {health && !health.ready && (
        <div className="mb-4 text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
          <p className="font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Push not fully ready on server
          </p>
          {!health.tableOk && (
            <p>
              <strong>Database:</strong> {health.tableError || 'Run migration 105 in Supabase SQL editor.'}
            </p>
          )}
          {!health.serviceRoleKey && (
            <p>
              <strong>Vercel:</strong> Add <code>SUPABASE_SERVICE_ROLE_KEY</code> environment variable.
            </p>
          )}
          {(!health.vapidPublic || !health.vapidPrivate) && (
            <p>
              <strong>VAPID:</strong> Add public + private keys in Vercel and redeploy.
            </p>
          )}
          {health.vapidError && (
            <p>
              <strong>VAPID pair:</strong> {health.vapidError}
            </p>
          )}
        </div>
      )}

      {health?.ready && (
        <p className="mb-4 text-xs text-green-800 bg-green-50 rounded-lg px-3 py-2">
          Server ready · {health.subscriptionCount ?? 0} device subscription(s) saved in database.
        </p>
      )}

      {lastError && (
        <div className="mb-4 text-xs text-red-900 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <strong>Last error:</strong> {lastError}
        </div>
      )}

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
              ? `${selected.name || selected.email} has notifications enabled on ${selected.pushDevices} device(s)${selected.pushDeviceHint ? ` (${describeDevice(selected.pushDeviceHint)})` : ''}.`
              : `${selected.name || selected.email} has not enabled notifications — ask them to open Profile → Enable notifications on their phone.`}
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
