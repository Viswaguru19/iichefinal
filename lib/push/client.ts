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
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!supportsWebPush()) {
    toast.error('Push notifications are not supported in this browser');
    return false;
  }

  if (isIOSDevice() && !isStandaloneDisplay()) {
    toast.error('On iPhone: use Install App first, then enable notifications from the home screen icon');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast.error('Notification permission denied');
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

  // Send immediate test so the user knows it worked
  try {
    const welcome = await fetch('/api/push/welcome', { method: 'POST' });
    if (!welcome.ok) {
      toast.success('Notifications enabled — test alert could not be sent; try again from Admin');
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
