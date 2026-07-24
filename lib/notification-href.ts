/** Resolve in-app link for a notification row (DB uses related_id; legacy may use link). */
export function getNotificationHref(n: {
  type: string;
  related_id?: string | null;
  link?: string | null;
}): string | null {
  if (n.type === 'chat' || n.type === 'message') {
    if (n.link?.startsWith('/dashboard/chat')) return n.link;
    if (n.link?.includes('/dashboard/messages')) {
      const qs = n.link.includes('?') ? n.link.slice(n.link.indexOf('?')) : '';
      return `/dashboard/chat${qs}`;
    }
    if (n.link?.includes('/dashboard/chat/group')) {
      const qs = n.link.includes('?') ? n.link.slice(n.link.indexOf('?') + 1) : '';
      const params = new URLSearchParams(qs);
      const id = params.get('id') || params.get('group');
      return id ? `/dashboard/chat?group=${encodeURIComponent(id)}` : '/dashboard/chat';
    }
    return n.link || '/dashboard/chat';
  }

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
