'use client';

import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { isDemoModeClient, setDemoFlagClient } from '@/lib/demo';
import { useEffect, useState } from 'react';

/** Persistent banner while exploring the portal in demo mode. */
export default function DemoModeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isDemoModeClient());
  }, []);

  if (!show) return null;

  return (
    <div className="sticky top-0 z-[60] bg-gradient-to-r from-teal-700 to-cyan-700 text-white text-sm shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <FlaskConical className="w-4 h-4 shrink-0" aria-hidden />
          <span>
            Demo mode — explore the portal. Real data is hidden and changes are disabled.
          </span>
        </p>
        <Link
          href="/login"
          onClick={() => setDemoFlagClient(false)}
          className="underline underline-offset-2 hover:text-teal-100 shrink-0"
        >
          Exit demo
        </Link>
      </div>
    </div>
  );
}
