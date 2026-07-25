'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { isIOSDevice, isStandaloneDisplay, supportsWebPush } from '@/lib/pwa';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const isChat = window.location.pathname.startsWith('/chat');
  return navigator.serviceWorker.register(isChat ? '/sw-chat.js' : '/sw.js', {
    scope: isChat ? '/chat' : '/dashboard',
  });
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!supportsWebPush()) {
    toast.error('Push notifications are not supported in this browser');
    return false;
  }

  if (isIOSDevice() && !isStandaloneDisplay()) {
    toast.error('On iPhone: add the app to Home Screen first, then enable notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast.error('Notification permission denied');
    return false;
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    toast.error('Push is not configured yet (missing VAPID key)');
    return false;
  }

  const reg = await registerServiceWorker();
  if (!reg) {
    toast.error('Could not register service worker');
    return false;
  }

  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!res.ok) {
    toast.error('Failed to save push subscription');
    return false;
  }

  try {
    localStorage.setItem('push-enabled', '1');
  } catch {
    // ignore
  }

  toast.success('Mobile notifications enabled');
  return true;
}

export default function PushNotificationManager() {
  const [showBanner, setShowBanner] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!supportsWebPush()) return;
    try {
      if (localStorage.getItem('push-enabled') === '1') return;
      if (localStorage.getItem('push-banner-dismissed')) return;
    } catch {
      // ignore
    }

    if (Notification.permission === 'granted') {
      void subscribeToPushNotifications();
      return;
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
