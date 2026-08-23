-- Migration: Comprehensive Chat RLS Policies
-- Description: Setup Row Level Security for all chat-related tables
-- Phase 1, Task 1.8

-- ============================================
-- ENABLE RLS ON ALL CHAT TABLES
-- ============================================

ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_forwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CHAT GROUPS POLICIES
-- ============================================

-- Users can view groups they are participants of
DROP POLICY IF EXISTS "Users can view their chat groups" ON chat_groups;
CREATE POLICY "Users can view their chat groups"
ON chat_groups FOR SELECT
USING (
  id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
  )
);

-- Only admins can create custom groups (system/committee groups created by triggers)
DROP POLICY IF EXISTS "Admins can create custom groups" ON chat_groups;
CREATE POLICY "Admins can create custom groups"
ON chat_groups FOR INSERT
WITH CHECK (
  chat_type = 'custom_group'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- Group admins can update group details
DROP POLICY IF EXISTS "Group admins can update groups" ON chat_groups;
CREATE POLICY "Group admins can update groups"
ON chat_groups FOR UPDATE
USING (
  id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
    AND is_admin = true
  )
);

-- System groups cannot be deleted (enforced by constraint)
-- Custom groups can be deleted by group admins
DROP POLICY IF EXISTS "Group admins can delete custom groups" ON chat_groups;
CREATE POLICY "Group admins can delete custom groups"
ON chat_groups FOR DELETE
USING (
  chat_type = 'custom_group'
  AND id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
    AND is_admin = true
  )
);

-- ============================================
-- CHAT PARTICIPANTS POLICIES
-- ============================================

-- Users can view participants of groups they're in
DROP POLICY IF EXISTS "Users can view group participants" ON chat_participants;
CREATE POLICY "Users can view group participants"
ON chat_participants FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
  )
);

-- Group admins can add participants to custom groups
DROP POLICY IF EXISTS "Group admins can add participants" ON chat_participants;
CREATE POLICY "Group admins can add participants"
ON chat_participants FOR INSERT
WITH CHECK (
  group_id IN (
    SELECT cg.id FROM chat_groups cg
    JOIN chat_participants cp ON cp.group_id = cg.id
    WHERE cp.user_id = auth.uid()
    AND cp.is_admin = true
    AND cg.chat_type = 'custom_group'
  )
);

-- Users can update their own participant record (last_read_at)
DROP POLICY IF EXISTS "Users can update own participant record" ON chat_participants;
CREATE POLICY "Users can update own participant record"
ON chat_participants FOR UPDATE
USING (user_id = auth.uid());

-- Group admins can remove participants from custom groups
DROP POLICY IF EXISTS "Group admins can remove participants" ON chat_participants;
CREATE POLICY "Group admins can remove participants"
ON chat_participants FOR DELETE
USING (
  group_id IN (
    SELECT cg.id FROM chat_groups cg
    JOIN chat_participants cp ON cp.group_id = cg.id
    WHERE cp.user_id = auth.uid()
    AND cp.is_admin = true
    AND cg.chat_type = 'custom_group'
  )
);

-- ============================================
-- CHAT MESSAGES POLICIES
-- ============================================

-- Users can view messages in groups they're participants of
DROP POLICY IF EXISTS "Users can view group messages" ON chat_messages;
CREATE POLICY "Users can view group messages"
ON chat_messages FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
  )
  AND is_deleted = false
);

-- Users can send messages to groups they're participants of
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
CREATE POLICY "Users can send messages"
ON chat_messages FOR INSERT
WITH CHECK (
  group_id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
  )
  AND sender_id = auth.uid()
);

-- Users can update their own messages (for editing)
DROP POLICY IF EXISTS "Users can edit own messages" ON chat_messages;
CREATE POLICY "Users can edit own messages"
ON chat_messages FOR UPDATE
USING (
  sender_id = auth.uid()
  AND created_at > NOW() - INTERVAL '5 minutes'
);

-- Users can delete their own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
CREATE POLICY "Users can delete own messages"
ON chat_messages FOR DELETE
USING (sender_id = auth.uid());

-- ============================================
-- MESSAGE REACTIONS POLICIES
-- ============================================

-- Users can view reactions on messages they can see
DROP POLICY IF EXISTS "Users can view message reactions" ON message_reactions;
CREATE POLICY "Users can view message reactions"
ON message_reactions FOR SELECT
USING (
  message_id IN (
    SELECT cm.id FROM chat_messages cm
    JOIN chat_participants cp ON cp.group_id = cm.group_id
    WHERE cp.user_id = auth.uid()
  )
);

-- Users can add reactions to messages they can see
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions"
ON message_reactions FOR INSERT
WITH CHECK (
  message_id IN (
    SELECT cm.id FROM chat_messages cm
    JOIN chat_participants cp ON cp.group_id = cm.group_id
    WHERE cp.user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- Users can remove their own reactions
DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;
CREATE POLICY "Users can remove own reactions"
ON message_reactions FOR DELETE
USING (user_id = auth.uid());

-- ============================================
-- MESSAGE READ STATUS POLICIES
-- ============================================

-- Users can view read status of messages in their groups
DROP POLICY IF EXISTS "Users can view read status" ON message_read_status;
CREATE POLICY "Users can view read status"
ON message_read_status FOR SELECT
USING (
  message_id IN (
    SELECT cm.id FROM chat_messages cm
    JOIN chat_participants cp ON cp.group_id = cm.group_id
    WHERE cp.user_id = auth.uid()
  )
);

-- System can create read status records (via trigger)
DROP POLICY IF EXISTS "System can create read status" ON message_read_status;
CREATE POLICY "System can create read status"
ON message_read_status FOR INSERT
WITH CHECK (true);

-- Users can update their own read status
DROP POLICY IF EXISTS "Users can update own read status" ON message_read_status;
CREATE POLICY "Users can update own read status"
ON message_read_status FOR UPDATE
USING (user_id = auth.uid());

-- ============================================
-- MESSAGE FORWARDS POLICIES
-- ============================================

-- Users can view forward records for messages they can see
DROP POLICY IF EXISTS "Users can view forwards" ON message_forwards;
CREATE POLICY "Users can view forwards"
ON message_forwards FOR SELECT
USING (
  original_message_id IN (
    SELECT cm.id FROM chat_messages cm
    JOIN chat_participants cp ON cp.group_id = cm.group_id
    WHERE cp.user_id = auth.uid()
  )
  OR forwarded_to_group_id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
  )
);

-- Users can create forward records when forwarding messages
DROP POLICY IF EXISTS "Users can forward messages" ON message_forwards;
CREATE POLICY "Users can forward messages"
ON message_forwards FOR INSERT
WITH CHECK (
  -- User can see original message
  original_message_id IN (
    SELECT cm.id FROM chat_messages cm
    JOIN chat_participants cp ON cp.group_id = cm.group_id
    WHERE cp.user_id = auth.uid()
  )
  -- User is participant in target group
  AND forwarded_to_group_id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
  )
  AND forwarded_by = auth.uid()
);

-- ============================================
-- TYPING INDICATORS POLICIES
-- ============================================

-- Users can view typing indicators in their groups
DROP POLICY IF EXISTS "Users can view typing indicators" ON typing_indicators;
CREATE POLICY "Users can view typing indicators"
ON typing_indicators FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM chat_participants
    WHERE user_id = auth.uid()
  )
);

-- Users can create/update their own typing indicators
DROP POLICY IF EXISTS "Users can manage own typing indicators" ON typing_indicators;
CREATE POLICY "Users can manage own typing indicators"
ON typing_indicators FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS FOR CHAT PERMISSIONS
-- ============================================

-- Function to check if user can send messages in a group
CREATE OR REPLACE FUNCTION can_send_message_in_group(
  p_user_id UUID,
  p_group_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_chat_type TEXT;
  v_is_participant BOOLEAN;
  v_user_role TEXT;
  v_executive_role TEXT;
  v_is_head BOOLEAN;
  v_is_cohead BOOLEAN;
BEGIN
  -- Check if user is participant
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE group_id = p_group_id
    AND user_id = p_user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RETURN FALSE;
  END IF;
  
  -- Get chat type
  SELECT chat_type INTO v_chat_type
  FROM chat_groups
  WHERE id = p_group_id;
  
  -- For organization groups, everyone can send
  IF v_chat_type = 'organization' THEN
    RETURN TRUE;
  END IF;
  
  -- For personal and committee groups, participants can send
  IF v_chat_type IN ('personal', 'committee', 'custom_group') THEN
    RETURN TRUE;
  END IF;
  
  -- For executive group, only EC members can send
  IF v_chat_type = 'executive' THEN
    SELECT executive_role INTO v_executive_role
    FROM profiles
    WHERE id = p_user_id;
    
    RETURN v_executive_role IS NOT NULL;
  END IF;
  
  -- For heads group, only heads can send
  IF v_chat_type = 'heads' THEN
    SELECT EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = p_user_id
      AND position = 'head'
    ) INTO v_is_head;
    
    RETURN v_is_head;
  END IF;
  
  -- For coheads group, only co-heads can send
  IF v_chat_type = 'coheads' THEN
    SELECT EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = p_user_id
      AND position = 'co_head'
    ) INTO v_is_cohead;
    
    RETURN v_is_cohead;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes for chat_participants lookups
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id 
ON chat_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_participants_group_user 
ON chat_participants(group_id, user_id);

-- Indexes for chat_messages queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_created 
ON chat_messages(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender 
ON chat_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to 
ON chat_messages(reply_to) 
WHERE reply_to IS NOT NULL;

-- Indexes for message_read_status
CREATE INDEX IF NOT EXISTS idx_message_read_status_message 
ON message_read_status(message_id);

CREATE INDEX IF NOT EXISTS idx_message_read_status_user 
ON message_read_status(user_id);

CREATE INDEX IF NOT EXISTS idx_message_read_status_unread 
ON message_read_status(user_id, message_id) 
WHERE read_at IS NULL;

-- Indexes for typing_indicators
CREATE INDEX IF NOT EXISTS idx_typing_indicators_group 
ON typing_indicators(group_id, updated_at DESC);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant authenticated users access to chat tables
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON message_read_status TO authenticated;
GRANT SELECT, INSERT ON message_forwards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON typing_indicators TO authenticated;
