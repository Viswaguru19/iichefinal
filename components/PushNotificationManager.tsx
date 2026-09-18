'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { isIOSDevice, isStandaloneDisplay, supportsWebPush } from '@/lib/pwa';
import { subscribeToPushNotifications, syncPushSubscription } from '@/lib/push/client';

export default function PushNotificationManager() {
  const [showBanner, setShowBanner] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!supportsWebPush()) return;

    if (Notification.permission === 'granted') {
      void syncPushSubscription();
      return;
    }

    try {
      if (localStorage.getItem('push-banner-dismissed')) return;
    } catch {
      // ignore
    }

    if (Notification.permission === 'denied') return;

    setIosHint(isIOSDevice() && !isStandaloneDisplay());
    setShowBanner(true);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] inset-x-3 z-[65] sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-sm">
      <div className="rounded-2xl border border-indigo-200/90 bg-white/95 backdrop-blur-md shadow-lg p-3.5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <BellRing className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Get alerts outside the app</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              {iosHint
                ? 'Add to Home Screen from Safari, open the app icon, then tap Enable.'
                : 'Free lock-screen notifications for tasks, approvals, and events.'}
            </p>
            {!iosHint && (
              <button
                type="button"
                onClick={() => void subscribeToPushNotifications().then((ok) => ok && setShowBanner(false))}
                className="mt-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg"
              >
                Enable notifications
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowBanner(false);
              try {
                localStorage.setItem('push-banner-dismissed', String(Date.now()));
              } catch {
                // ignore
              }
            }}
            className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
