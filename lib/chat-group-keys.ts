/** Always use chat_groups.id so committee UUIDs cannot collide with system groups. */
export function groupMessagesChannelId(g: {
  id: string;
  chat_type?: string | null;
  committee_id?: string | null;
}) {
  return String(g.id);
}
