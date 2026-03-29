/** Resolve in-app link for a notification row (DB uses related_id; legacy may use link). */
export function getNotificationHref(n: {
  type: string;
  related_id?: string | null;
  link?: string | null;
}): string | null {
  if (n.link) return n.link;
  const id = n.related_id;
  if (!id) return null;
  switch (n.type) {
    case 'meeting':
      return `/dashboard/meetings/${id}`;
    case 'proposal':
    case 'proposal_update':
      return `/dashboard/event-detail/${id}`;
    default:
      return null;
  }
}
