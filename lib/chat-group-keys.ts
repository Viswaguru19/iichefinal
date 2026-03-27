/** group_messages.group_id and ChatWindow must use the same key as chat sidebar rows. */
export function groupMessagesChannelId(g: {
  id: string;
  chat_type: string | null;
  committee_id: string | null;
}) {
  if (g.chat_type === 'committee' && g.committee_id) return String(g.committee_id);
  return String(g.id);
}
