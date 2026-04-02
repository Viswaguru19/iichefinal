'use client';

import { createContext, useContext } from 'react';

export type PortalPresenceValue = {
  onlineUserIds: Set<string>;
  viewerIsAdmin: boolean;
  /** Same as viewerIsAdmin — use for chat UI gating */
  showOnlinePresence: boolean;
  currentUserId: string | null;
  ready: boolean;
};

const defaultValue: PortalPresenceValue = {
  onlineUserIds: new Set(),
  viewerIsAdmin: false,
  showOnlinePresence: false,
  currentUserId: null,
  ready: false,
};

export const PortalPresenceContext = createContext<PortalPresenceValue>(defaultValue);

export function usePortalPresence() {
  return useContext(PortalPresenceContext);
}
