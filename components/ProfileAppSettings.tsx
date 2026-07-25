'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, Download, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import DynamicLogo from '@/components/DynamicLogo';
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
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-700" />
          <h3 className="text-lg font-semibold text-gray-900">Install apps</h3>
        </div>
        <p className="text-sm text-gray-600">
          You can install <strong>two separate apps</strong> on your phone — both use the IIChE logo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
                <DynamicLogo width={28} height={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">IIChE</p>
                <p className="text-[11px] text-gray-500">Portal — events, forms, tasks</p>
              </div>
            </div>
            {ios ? (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                From the dashboard in Safari: Share → Add to Home Screen as <strong>IIChE</strong>.
              </p>
            ) : (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Open the dashboard in Chrome/Edge and use Install when prompted.
              </p>
            )}
            <Link href="/dashboard" className="inline-flex text-xs font-semibold text-indigo-600 hover:underline">
              Open portal →
            </Link>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#111b21] flex items-center justify-center overflow-hidden ring-1 ring-[#00a884]/40">
                <DynamicLogo width={28} height={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">IIChE Chat</p>
                <p className="text-[11px] text-gray-500">WhatsApp-style messaging</p>
              </div>
            </div>
            {ios ? (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Open Chat in Safari, then Share → Add to Home Screen as <strong>IIChE Chat</strong>.
              </p>
            ) : (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Open Chat and tap <strong>Install IIChE Chat</strong> when prompted.
              </p>
            )}
            <Link
              href="/chat"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Open IIChE Chat →
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
        </div>

        <p className="text-sm text-gray-600">
          Get alerts on your phone for chat, proposals, approvals, tasks, meetings, forms, and reminders.
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
              <li>Open <strong>Chrome</strong> or <strong>Edge</strong></li>
              <li>Log in, then tap <strong>Enable notifications</strong> → <strong>Allow</strong></li>
            </ol>
          </div>
        )}

        {ios && !installed && (
          <div className="text-xs text-indigo-900 bg-indigo-50 rounded-lg px-3 py-2 space-y-1">
            <p className="font-semibold">iPhone setup (required):</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Open in <strong>Safari</strong></li>
              <li>Share → <strong>Add to Home Screen</strong></li>
              <li>Open the icon, then enable notifications</li>
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
            Enabled on this device for chat and portal alerts.
          </p>
        )}
      </div>
    </div>
  );
}
