'use client';

import { useEffect } from 'react';
import { syncPushSubscription } from '@/lib/push/client';

/** Registers the IIChE portal worker with dashboard-only ownership. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) => new URL(registration.scope).pathname === '/')
            .map((registration) => registration.unregister()),
        );
        await navigator.serviceWorker.register('/sw.js', { scope: '/dashboard' });
        await syncPushSubscription();
      } catch {
        // Service-worker support is an enhancement, not a navigation blocker.
      }
    })();
  }, []);

  return null;
}
