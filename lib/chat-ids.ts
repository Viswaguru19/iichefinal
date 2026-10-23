/** Stable chat_groups ids — must not reuse committee UUIDs as message channel keys. */
export const CHAT_OFFICIAL_GROUP_ID = '00000000-0000-0000-0000-000000000001';
/** @deprecated Use CHAT_OFFICIAL_GROUP_ID */
export const WHOLE_ORG_CHAT_GROUP_ID = CHAT_OFFICIAL_GROUP_ID;
export const CHAT_EC_GROUP_ID = '00000000-0000-0000-0000-000000000002';
export const CHAT_HEADS_GROUP_ID = '00000000-0000-0000-0000-000000000003';
export const CHAT_COHEADS_GROUP_ID = '00000000-0000-0000-0000-000000000004';
export const CHAT_UNOFFICIAL_GROUP_ID = 'c1a70000-0000-4000-8000-00000000000f';
export const LEGACY_UNOFFICIAL_GROUP_ID = '00000000-0000-0000-0000-000000000005';
export const EC_COMMITTEE_ID = '00000000-0000-0000-0000-000000000001';

export function resolveChatGroupId(chat: {
  id: string;
  type?: string;
  participantGroupId?: string | null;
  groupChatType?: string | null;
}) {
  const ids = [chat.participantGroupId, chat.id].filter(Boolean) as string[];
  if (chat.groupChatType === 'unofficial' || ids.includes(LEGACY_UNOFFICIAL_GROUP_ID)) {
    return CHAT_UNOFFICIAL_GROUP_ID;
  }
  return chat.participantGroupId || (chat.type === 'group' ? chat.id : undefined);
}
