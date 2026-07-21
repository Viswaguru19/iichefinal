'use client';

import { useEffect } from 'react';

/** Registers the service worker early so push + asset caching work when the app is closed. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // non-fatal
    });
  }, []);

  return null;
}
