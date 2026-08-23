'use client';

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
    toast.error('On iPhone: Add to Home Screen in Safari first, then enable notifications from that icon');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast.error('Notification permission denied — allow in phone Settings');
    return false;
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    toast.error('Push is not configured yet (missing VAPID key on server)');
    return false;
  }

  const reg = await registerServiceWorker();
  if (!reg) {
    toast.error('Could not register service worker');
    return false;
  }

  await navigator.serviceWorker.ready;

  // Fresh subscription — fixes stale keys after VAPID was added/changed on server
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {
      // continue
    }
  }

  let subscription;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  } catch {
    toast.error('Could not subscribe to push — on iPhone use the Home Screen app');
    return false;
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error || 'Failed to save push subscription';
    if (msg.includes('push_subscriptions')) {
      toast.error('Database not ready — admin must run migration 109 in Supabase');
    } else {
      toast.error(msg);
    }
    return false;
  }

  try {
    localStorage.setItem('push-enabled', '1');
  } catch {
    // ignore
  }

  try {
    const welcome = await fetch('/api/push/welcome', { method: 'POST' });
    const welcomeData = await welcome.json().catch(() => ({}));
    if (!welcome.ok) {
      const err = (welcomeData as { deliveryError?: string; error?: string }).deliveryError;
      toast.success('Subscribed — test alert pending. ' + (err || 'Try admin test again.'));
      return true;
    }
  } catch {
    toast.success('Notifications enabled');
    return true;
  }

  toast.success('Notifications enabled — check your phone for a test alert');
  return true;
}

export function isPushEnabledLocally(): boolean {
  try {
    return localStorage.getItem('push-enabled') === '1' || Notification.permission === 'granted';
  } catch {
    return false;
  }
}
