import type { PortalNotificationInsert } from '@/lib/portal-notifications-client';
import { sendWebPushToUsers } from '@/lib/push/send-web-push';
import { getNotificationHref } from '@/lib/notification-href';

export async function dispatchPushForNotificationRows(rows: PortalNotificationInsert[]) {
  if (!rows.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const url = row.link || getNotificationHref(row) || '/dashboard';
    const result = await sendWebPushToUsers([row.user_id], {
      title: row.title,
      body: row.message,
      url,
      tag: row.type,
    });
    sent += result.sent;
    failed += result.failed;
  }

  return { sent, failed };
}
