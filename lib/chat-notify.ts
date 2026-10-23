import { insertPortalNotifications } from '@/lib/portal-notifications-client';

/** Portal + push when a chat message is sent (works even if DB notify triggers are missing). */
export async function notifyChatRecipients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: {
    senderId: string;
    senderName: string;
    preview: string;
    isDirect: boolean;
    otherUserId?: string;
    groupId?: string;
    groupName?: string;
    participantGroupId?: string | null;
  },
) {
  const preview = String(opts.preview || 'New message').slice(0, 120);
  let recipientIds: string[] = [];

  if (opts.isDirect && opts.otherUserId && opts.otherUserId !== opts.senderId) {
    recipientIds = [opts.otherUserId];
  } else if (opts.participantGroupId) {
    const { data } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('group_id', opts.participantGroupId);
    recipientIds = (data || [])
      .map((r: { user_id: string }) => r.user_id)
      .filter((id: string) => id && id !== opts.senderId);
  }

  if (!recipientIds.length) return;

  const title = opts.isDirect
    ? `${opts.senderName || 'Someone'} messaged you`
    : opts.groupName || 'Group chat';
  const message = opts.isDirect ? preview : `${opts.senderName || 'Someone'}: ${preview}`;
  const link = opts.isDirect
    ? `/chat?user=${encodeURIComponent(opts.senderId)}`
    : `/chat?group=${encodeURIComponent(opts.groupId || '')}`;

  const rows = recipientIds.map((user_id) => ({
    user_id,
    type: 'chat',
    title,
    message,
    link,
  }));

  try {
    await insertPortalNotifications(supabase, rows);
  } catch (err) {
    console.error('chat notify failed', err);
  }
}
