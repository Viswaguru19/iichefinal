'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PortalPresenceContext, type PortalPresenceValue } from '@/components/dashboard/PortalPresenceContext';

/**
 * Subscribes every authenticated dashboard visitor to the shared presence channel
 * so portal admins can see who is online anywhere under /dashboard, not only on chat.
 */
export default function PortalPresenceProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setReady(true);
        return;
      }
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, is_faculty, role')
        .eq('id', user.id)
        .single();
      const p = profile as { is_admin?: boolean; is_faculty?: boolean; role?: string } | null;
      const canSeePresence =
        !!p?.is_admin ||
        !!p?.is_faculty ||
        ['super_admin', 'secretary'].includes(String(p?.role || ''));
      if (!cancelled) setViewerIsAdmin(canSeePresence);

      const ch = supabase.channel('online-users', { config: { presence: { key: user.id } } });
      channelRef.current = ch;

      ch.on('presence', { event: 'sync' }, () => {
        const state = channelRef.current?.presenceState() ?? {};
        setOnlineUserIds(new Set(Object.keys(state)));
      }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && channelRef.current) {
          await channelRef.current.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase]);

  const value = useMemo<PortalPresenceValue>(
    () => ({
      onlineUserIds,
      viewerIsAdmin,
      showOnlinePresence: viewerIsAdmin,
      currentUserId,
      ready,
    }),
    [onlineUserIds, viewerIsAdmin, currentUserId, ready],
  );

  return <PortalPresenceContext.Provider value={value}>{children}</PortalPresenceContext.Provider>;
}
