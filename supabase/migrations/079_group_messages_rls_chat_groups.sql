-- group_messages.group_id must match how the app routes messages (see lib/chat-group-keys.ts):
-- committee chats use committee_id::text; others use chat_groups.id::text.
-- Older policies only allowed iiche-main / all-heads / all-coheads / committee_id, so UUID group_ids failed.

DROP POLICY IF EXISTS "Users can read group messages" ON group_messages;
DROP POLICY IF EXISTS "Users can send group messages" ON group_messages;
DROP POLICY IF EXISTS "Users can view messages in their groups" ON group_messages;
DROP POLICY IF EXISTS "Users can send messages to their groups" ON group_messages;

-- Idempotent: allow re-run after 080 or a failed partial apply
DROP POLICY IF EXISTS "group_messages_select_by_membership" ON group_messages;
DROP POLICY IF EXISTS "group_messages_insert_by_membership" ON group_messages;

-- Read: member of the chat group (by chat_groups.id or committee channel id)
CREATE POLICY "group_messages_select_by_membership"
ON group_messages FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM chat_groups cg
      INNER JOIN chat_participants cp ON cp.group_id = cg.id
      WHERE cp.user_id = auth.uid()
        AND (
          cg.id::text = (group_id)::text
          OR (cg.committee_id IS NOT NULL AND cg.committee_id::text = (group_id)::text)
        )
    )
    OR (group_id)::text = 'iiche-main'
    OR (
      (group_id)::text = 'all-heads'
      AND EXISTS (
        SELECT 1 FROM committee_members
        WHERE user_id = auth.uid() AND position = 'head'
      )
    )
    OR (
      (group_id)::text = 'all-coheads'
      AND EXISTS (
        SELECT 1 FROM committee_members
        WHERE user_id = auth.uid() AND position = 'co_head'
      )
    )
    OR EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = auth.uid() AND committee_id::text = (group_id)::text
    )
  )
);

-- Send: same membership + sender must be current user
CREATE POLICY "group_messages_insert_by_membership"
ON group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM chat_groups cg
      INNER JOIN chat_participants cp ON cp.group_id = cg.id
      WHERE cp.user_id = auth.uid()
        AND (
          cg.id::text = (group_id)::text
          OR (cg.committee_id IS NOT NULL AND cg.committee_id::text = (group_id)::text)
        )
    )
    OR (group_id)::text = 'iiche-main'
    OR (
      (group_id)::text = 'all-heads'
      AND EXISTS (
        SELECT 1 FROM committee_members
        WHERE user_id = auth.uid() AND position = 'head'
      )
    )
    OR (
      (group_id)::text = 'all-coheads'
      AND EXISTS (
        SELECT 1 FROM committee_members
        WHERE user_id = auth.uid() AND position = 'co_head'
      )
    )
    OR EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = auth.uid() AND committee_id::text = (group_id)::text
    )
  )
);
