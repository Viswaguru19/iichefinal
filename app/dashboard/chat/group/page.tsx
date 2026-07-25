'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalLoadingScreen from '@/components/PortalLoadingScreen';

function GroupChatRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const group = searchParams.get('group') || searchParams.get('id');
    router.replace(group ? `/chat?group=${encodeURIComponent(group)}` : '/chat');
  }, [router, searchParams]);

  return <PortalLoadingScreen message="Opening group chat…" />;
}

export default function GroupChatPage() {
  return (
    <Suspense fallback={<PortalLoadingScreen message="Opening group chat…" />}>
      <GroupChatRedirect />
    </Suspense>
  );
}
