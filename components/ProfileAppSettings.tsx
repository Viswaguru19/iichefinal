'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  isAndroidDevice,
  isChromeOrEdgeOnAndroid,
  isInAppBrowser,
  isIOSDevice,
  isStandaloneDisplay,
  supportsWebPush,
} from '@/lib/pwa';
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
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIos(isIOSDevice());
    setAndroid(isAndroidDevice());
    setInApp(isInAppBrowser());
    setInstalled(isStandaloneDisplay());
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

    if (inApp) {
      toast.error('Open this site in Chrome or Edge (not Instagram/WhatsApp browser)');
      return;
    }

    if (ios && !installed) {
      toast.error('On iPhone: Add to Home Screen first (see steps below)');
      return;
    }

    if (android && !isChromeOrEdgeOnAndroid()) {
      toast.error('On Android: open in Chrome or Edge, then enable notifications');
      return;
    }

    if (!supportsWebPush()) {
      toast.error('This browser does not support push — use Chrome or Edge');
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

  const canEnable =
    !loading &&
    Boolean(pushStatus?.configured) &&
    !inApp &&
    (!ios || installed) &&
    (!android || isChromeOrEdgeOnAndroid()) &&
    supportsWebPush();

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
      </div>

      <p className="text-sm text-gray-600">
        Get alerts on your phone for proposals, approvals, tasks, meetings, forms, and reminders.
      </p>

      {pushStatus && !pushStatus.configured && (
        <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
          Push is not configured on the server yet. Admin must add VAPID keys in Vercel.
        </p>
      )}

      {inApp && (
        <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
          You are in an in-app browser. Copy the link and open it in <strong>Chrome</strong> or{' '}
          <strong>Edge</strong> on your phone.
        </p>
      )}

      {android && !inApp && !pushOn && (
        <div className="text-xs text-indigo-900 bg-indigo-50 rounded-lg px-3 py-2 space-y-1">
          <p className="font-semibold">Android setup:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Open <strong>Chrome</strong> or <strong>Edge</strong> (not WhatsApp/Instagram browser)</li>
            <li>Go to this site and log in</li>
            <li>Tap <strong>Enable notifications</strong> below → <strong>Allow</strong></li>
          </ol>
          <p className="pt-1 text-indigo-800">
            If blocked: Chrome ⋮ → Settings → Site settings → Notifications → allow for this site.
          </p>
        </div>
      )}

      {ios && !installed && (
        <div className="text-xs text-indigo-900 bg-indigo-50 rounded-lg px-3 py-2 space-y-1">
          <p className="font-semibold">iPhone setup (required):</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Open this site in <strong>Safari</strong></li>
            <li>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></li>
            <li>Open from the <strong>Home Screen icon</strong></li>
            <li>Tap <strong>Enable notifications</strong> → <strong>Allow</strong></li>
          </ol>
          <p className="pt-1 text-indigo-800">Requires iOS 16.4+.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void enableNotifications()}
        disabled={!canEnable}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <BellRing className="w-4 h-4" />
        {loading ? 'Enabling…' : pushOn ? 'Re-enable notifications' : 'Enable notifications'}
      </button>

      {pushOn && (
        <p className="text-xs text-green-800 bg-green-50 rounded-lg px-3 py-2">
          {android
            ? 'Enabled on Android. You should get a test alert. If admin test fails, tap Re-enable above or check Chrome → Site settings → Notifications.'
            : 'Enabled on this device. If admin test fails, tap Re-enable above or check Settings → Notifications → IIChE AVVU.'}
        </p>
      )}
    </div>
  );
}
