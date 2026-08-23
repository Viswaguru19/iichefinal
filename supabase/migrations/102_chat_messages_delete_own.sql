-- Allow senders to delete their own chat messages (UI delete was blocked: no DELETE policies).

DROP POLICY IF EXISTS "Users can delete own sent messages" ON direct_messages;
CREATE POLICY "Users can delete own sent messages"
  ON direct_messages FOR DELETE
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "group_messages_delete_own" ON group_messages;
CREATE POLICY "group_messages_delete_own"
  ON group_messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND public.auth_user_can_access_group_messages_channel(CAST(group_id AS text))
  );
