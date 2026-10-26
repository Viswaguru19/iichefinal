'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PORTAL_ROUTES = [
  '/dashboard',
  '/dashboard/forms',
  '/dashboard/tasks',
  '/dashboard/proposals',
  '/dashboard/meetings',
  '/dashboard/documents',
  '/dashboard/accounts',
  '/dashboard/past-events',
  '/dashboard/propose-event',
  '/dashboard/profile',
  '/dashboard/notifications',
  '/dashboard/ai',
  '/dashboard/events/progress',
  '/dashboard/events/workflow',
  '/chat',
  '/committees',
  '/events',
];

/** Warm route JS after the dashboard is up so the next click is already loaded. */
export default function PrefetchPortalRoutes() {
  const router = useRouter();

  useEffect(() => {
    const run = () => {
      for (const href of PORTAL_ROUTES) {
        try {
          router.prefetch(href);
        } catch {
          /* ignore */
        }
      }
    };

    let timeoutId: number | undefined;
    let idleId: number | undefined;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(run, 400);
    }

    return () => {
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [router]);

  return null;
}
