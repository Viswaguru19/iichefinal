'use client';

import { useEffect, useState } from 'react';
import { BellRing, Download, Share, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { isIOSDevice, isStandaloneDisplay, supportsWebPush } from '@/lib/pwa';
import { isPushEnabledLocally, subscribeToPushNotifications } from '@/lib/push/client';

export default function ProfileAppSettings() {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIOSDevice());
    setPushOn(isPushEnabledLocally());

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
      toast('Open in Chrome/Edge on mobile, or use browser menu → Install app');
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
    setInstalled(isStandaloneDisplay());
  }

  async function enableNotifications() {
    const ok = await subscribeToPushNotifications();
    if (ok) setPushOn(true);
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">App &amp; notifications</h3>
      </div>
      <p className="text-sm text-gray-600">
        Install IIChE AVVU on your phone for full-screen use. Enable notifications to get alerts on your lock screen
        (new proposals, approvals, tasks, meetings, forms, finance, and reminders).
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => void installApp()}
          disabled={installed && !ios}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {ios ? <Share className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {installed ? 'App installed' : ios ? 'Install on iPhone (Share)' : canInstall ? 'Install app' : 'Install app'}
        </button>
        <button
          type="button"
          onClick={() => void enableNotifications()}
          disabled={!supportsWebPush() || pushOn}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
        >
          <BellRing className="w-4 h-4" />
          {pushOn ? 'Notifications enabled' : 'Enable notifications'}
        </button>
      </div>

      {ios && !installed && (
        <p className="text-xs text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2">
          iPhone: open this site in <strong>Safari</strong>, tap Share, then <strong>Add to Home Screen</strong>. Open
          from that icon, then tap Enable notifications here.
        </p>
      )}
    </div>
  );
}
