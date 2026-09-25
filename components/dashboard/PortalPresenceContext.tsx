'use client';

import { createContext, useContext } from 'react';

export type PortalPresenceValue = {
  onlineUserIds: Set<string>;
  viewerIsAdmin: boolean;
  /** Signed-in members can see who is online in the portal and in chat */
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
