'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { supportsWebPush } from '@/lib/pwa';
import { isPushEnabledLocally, subscribeToPushNotifications } from '@/lib/push/client';

type PushServerStatus = {
  configured: boolean;
  vapidPublic: boolean;
  vapidPrivate: boolean;
};

export default function ProfileAppSettings() {
  const [pushOn, setPushOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushServerStatus | null>(null);

  useEffect(() => {
    setPushOn(isPushEnabledLocally());
    void fetch('/api/push/status')
      .then((r) => r.json())
      .then((data: PushServerStatus) => setPushStatus(data))
      .catch(() => setPushStatus(null));
  }, []);

  async function enableNotifications() {
    if (pushStatus && !pushStatus.configured) {
      toast.error('Push is not configured on the server yet — contact admin');
      return;
    }
    if (!supportsWebPush()) {
      toast.error('Use Chrome or Edge on your phone for notifications');
      return;
    }

    setLoading(true);
    try {
      const ok = await subscribeToPushNotifications();
      if (ok) setPushOn(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
      </div>

      <p className="text-sm text-gray-600">
        Get alerts on your phone for proposals, approvals, tasks, meetings, forms, and reminders — even when the browser
        is closed.
      </p>

      {pushStatus && !pushStatus.configured && (
        <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
          Push is not configured on the server yet. Admin must add VAPID keys in Vercel.
        </p>
      )}

      <button
        type="button"
        onClick={() => void enableNotifications()}
        disabled={loading || pushOn || Boolean(pushStatus && !pushStatus.configured)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <BellRing className="w-4 h-4" />
        {loading ? 'Enabling…' : pushOn ? 'Notifications enabled ✓' : 'Enable notifications'}
      </button>

      {pushOn && (
        <p className="text-xs text-green-800 bg-green-50 rounded-lg px-3 py-2">
          You should receive a test notification on this device. If not, check that notifications are allowed in your
          phone settings.
        </p>
      )}
    </div>
  );
}
