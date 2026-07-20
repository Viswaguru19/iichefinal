import { getNotificationHref } from '@/lib/notification-href';

export type PortalNotificationInsert = {
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id?: string | null;
  link?: string | null;
  read?: boolean;
};

/** Fire-and-forget Web Push for portal notifications (free, uses VAPID). */
export async function dispatchPushForNotifications(rows: PortalNotificationInsert[]) {
  if (!rows.length || typeof window === 'undefined') return;

  const items = rows.map((row) => ({
    userId: row.user_id,
    title: row.title,
    body: row.message,
    url: row.link || getNotificationHref(row) || '/dashboard',
    tag: row.type,
  }));

  try {
    await fetch('/api/push/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
  } catch (err) {
    console.warn('[Push] dispatch failed:', err);
  }
}

export async function insertPortalNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: PortalNotificationInsert[],
) {
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw error;
  void dispatchPushForNotifications(rows);
}
