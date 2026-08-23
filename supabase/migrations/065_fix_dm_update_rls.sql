-- Add UPDATE policy for direct_messages (needed for marking messages as read)
DROP POLICY IF EXISTS "Users can update own received messages" ON direct_messages;
CREATE POLICY "Users can update own received messages"
  ON direct_messages FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
