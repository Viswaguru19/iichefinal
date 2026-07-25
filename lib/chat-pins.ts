/** Per-user pinned chat keys: `direct:<id>` or `group:<id>` */

export function chatPinKey(type: 'direct' | 'group', id: string): string {
  return `${type}:${id}`;
}

export function loadPinnedChatKeys(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`chat-pins-${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function savePinnedChatKeys(userId: string, keys: string[]): void {
  try {
    localStorage.setItem(`chat-pins-${userId}`, JSON.stringify(keys));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function togglePinnedChatKey(userId: string, key: string): string[] {
  const current = loadPinnedChatKeys(userId);
  const next = current.includes(key) ? current.filter((k) => k !== key) : [key, ...current];
  savePinnedChatKeys(userId, next);
  return next;
}
