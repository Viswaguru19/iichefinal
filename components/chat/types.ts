export interface ChatItem {
  id: string;
  name: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  type: 'direct' | 'group';
  unreadCount: number;
  /** chat_groups.id — use for chat_participants.last_read_at */
  participantGroupId?: string;
  groupChatType?: string | null;
  description?: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  executive_role: string | null;
  is_faculty: boolean;
  is_admin?: boolean;
  department: string | null;
  phone: string | null;
  created_at: string;
  committee_name?: string;
  committee_position?: string;
}
