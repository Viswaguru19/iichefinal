'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';

function MessagesRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const user = searchParams.get('user');
    const group = searchParams.get('group') || searchParams.get('id');
    const q = user ? `?user=${encodeURIComponent(user)}` : group ? `?group=${encodeURIComponent(group)}` : '';
    router.replace(`/dashboard/chat${q}`);
  }, [router, searchParams]);

  return <PortalLoadingScreen message="Opening chat…" />;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<PortalLoadingScreen message="Opening chat…" />}>
      <MessagesRedirect />
    </Suspense>
  );
}
