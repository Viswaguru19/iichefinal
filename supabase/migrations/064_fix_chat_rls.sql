-- Fix 1: Allow anyone to update group_messages (needed for poll votes)
-- The poll_data column stores votes as JSONB and any participant should be able to vote
DROP POLICY IF EXISTS "Users can update group messages" ON group_messages;
CREATE POLICY "Users can update group messages"
  ON group_messages FOR UPDATE
  USING (true);

-- Fix 2: Ensure direct_messages INSERT works correctly
-- Re-create the insert policy to be explicit
DROP POLICY IF EXISTS "Users can send messages" ON direct_messages;
CREATE POLICY "Users can send messages"
  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Fix 3: Ensure direct_messages SELECT works for both parties
DROP POLICY IF EXISTS "Users can view own messages" ON direct_messages;
CREATE POLICY "Users can view own messages"
  ON direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
