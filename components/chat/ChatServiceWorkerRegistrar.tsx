'use client';

import { useEffect } from 'react';

/** Registers the IIChE Chat worker without claiming portal routes. */
export default function ChatServiceWorkerRegistrar() {
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
        await navigator.serviceWorker.register('/sw-chat.js', { scope: '/chat' });
      } catch {
        // Service-worker support is an enhancement, not a navigation blocker.
      }
    })();
  }, []);

  return null;
}
