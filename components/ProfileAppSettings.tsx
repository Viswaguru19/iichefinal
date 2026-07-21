'use client';

import { useEffect, useState } from 'react';
import { BellRing, Download, ExternalLink, Share, Smartphone, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { isIOSDevice, isStandaloneDisplay, supportsWebPush } from '@/lib/pwa';
import { isPushEnabledLocally, subscribeToPushNotifications } from '@/lib/push/client';

type PushServerStatus = {
  configured: boolean;
  vapidPublic: boolean;
  vapidPrivate: boolean;
  webhookSecret: boolean;
  autoDispatchReady: boolean;
};

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
  if (/Firefox\//.test(ua)) return 'firefox';
  return 'other';
}

export default function ProfileAppSettings() {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pushStatus, setPushStatus] = useState<PushServerStatus | null>(null);
  const [browser, setBrowser] = useState('unknown');

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIOSDevice());
    setPushOn(isPushEnabledLocally());
    setBrowser(detectBrowser());

    void fetch('/api/push/status')
      .then((r) => r.json())
      .then((data: PushServerStatus) => setPushStatus(data))
      .catch(() => setPushStatus(null));

    const onInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  async function installApp() {
    if (ios && !installed) {
      toast('Safari → Share → Add to Home Screen', { icon: '📲' });
      return;
    }
    if (!deferredPrompt) {
      if (browser === 'edge') {
        toast('Edge menu (⋯) → Apps → Install this site as an app');
      } else if (browser === 'chrome') {
        toast('Chrome menu (⋮) → Install app / Add to Home screen');
      } else {
        toast('Use Chrome or Edge on Android/desktop, then Install app');
      }
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
    setInstalled(isStandaloneDisplay());
  }

  async function enableNotifications() {
    if (pushStatus && !pushStatus.configured) {
      toast.error('Push is not configured on the server yet — admin must add VAPID keys in Vercel');
      return;
    }
    const ok = await subscribeToPushNotifications();
    if (ok) setPushOn(true);
  }

  const pushBlockedReason = (() => {
    if (pushStatus && !pushStatus.configured) {
      return 'Server not configured: add VAPID keys in Vercel environment variables (see .env.local.example).';
    }
    if (ios && !installed) {
      return 'On iPhone: install the app to Home Screen first (Safari → Share → Add to Home Screen), then enable notifications.';
    }
    if (!supportsWebPush()) {
      return 'This browser does not support lock-screen push. Use Chrome/Edge, or install the app on Android.';
    }
    if (browser === 'safari' && !ios) {
      return 'Desktop Safari has limited push support — use Chrome or Edge for lock-screen alerts.';
    }
    return null;
  })();

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">App &amp; notifications</h3>
      </div>

      {/* Install */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-800">Install as app</p>
        <p className="text-sm text-gray-600">
          Full-screen app on your phone. Required on iPhone before notifications work.
        </p>
        <button
          type="button"
          onClick={() => void installApp()}
          disabled={installed && !ios}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {ios ? <Share className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {installed ? 'App installed ✓' : ios ? 'How to install on iPhone' : canInstall ? 'Install app' : 'Install app (Chrome/Edge)'}
        </button>
        {!installed && browser === 'edge' && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            <strong>Edge:</strong> ⋯ menu → <strong>Apps</strong> → <strong>Install this site as an app</strong>
          </p>
        )}
        {!installed && browser === 'chrome' && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            <strong>Chrome:</strong> ⋮ menu → <strong>Install app</strong> or <strong>Add to Home screen</strong>
          </p>
        )}
      </div>

      {/* Push */}
      <div className="space-y-2 border-t border-indigo-100 pt-4">
        <p className="text-sm font-medium text-gray-800">Lock-screen notifications</p>
        <p className="text-sm text-gray-600">
          Alerts when the app is closed — proposals, approvals, tasks, meetings, forms, and reminders.
        </p>
        {pushStatus && (
          <div className="text-xs rounded-lg px-3 py-2 space-y-1 bg-slate-50 text-slate-700">
            <p>
              Server push:{' '}
              <strong className={pushStatus.configured ? 'text-green-700' : 'text-amber-700'}>
                {pushStatus.configured ? 'Configured ✓' : 'Not configured'}
              </strong>
            </p>
            {!pushStatus.autoDispatchReady && pushStatus.configured && (
              <p className="text-amber-800">Add PUSH_WEBHOOK_SECRET + migration 106 in Supabase for automatic dispatch.</p>
            )}
          </div>
        )}
        {pushBlockedReason && !pushOn && (
          <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">{pushBlockedReason}</p>
        )}
        <button
          type="button"
          onClick={() => void enableNotifications()}
          disabled={(!supportsWebPush() && !(ios && installed)) || pushOn || Boolean(pushStatus && !pushStatus.configured)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
        >
          <BellRing className="w-4 h-4" />
          {pushOn ? 'Notifications enabled ✓' : 'Enable notifications'}
        </button>
      </div>

      {/* Play Store */}
      <div className="space-y-2 border-t border-indigo-100 pt-4">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-medium text-gray-800">Google Play Store</p>
        </div>
        <p className="text-sm text-gray-600">
          Yes — you can publish this portal on Play Store as a <strong>Trusted Web App (TWA)</strong>. It wraps the same
          website; push notifications work the same way after install.
        </p>
        <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1 bg-gray-50 rounded-lg px-3 py-2">
          <li>Deploy the site on HTTPS (e.g. iicheavvu.in on Vercel)</li>
          <li>Configure VAPID push keys (above)</li>
          <li>Use{' '}
            <a href="https://www.pwabuilder.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline inline-flex items-center gap-0.5">
              PWABuilder.com <ExternalLink className="w-3 h-3" />
            </a>{' '}
            → Package for Google Play (needs 512×512 PNG icon + $25 Play Developer account)
          </li>
        </ol>
      </div>

      {ios && !installed && (
        <p className="text-xs text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2">
          iPhone: open in <strong>Safari</strong> (not Chrome), Share → <strong>Add to Home Screen</strong>, open from
          that icon, then tap Enable notifications.
        </p>
      )}
    </div>
  );
}
