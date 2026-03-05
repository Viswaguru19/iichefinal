-- ============================================
-- UPDATE CHAT GROUP RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read group messages" ON group_messages;
DROP POLICY IF EXISTS "Users can send group messages" ON group_messages;

-- Policy: Users can view messages in groups they belong to
CREATE POLICY "Users can view messages in their groups" ON group_messages
  FOR SELECT
  USING (
    -- IIChE main group (everyone can see)
    group_id = 'iiche-main'
    OR
    -- All heads group (only heads can see)
    (group_id = 'all-heads' AND EXISTS (
      SELECT 1 FROM committee_members 
      WHERE user_id = auth.uid() 
      AND position = 'head'
    ))
    OR
    -- All co-heads group (only co-heads can see)
    (group_id = 'all-coheads' AND EXISTS (
      SELECT 1 FROM committee_members 
      WHERE user_id = auth.uid() 
      AND position = 'co_head'
    ))
    OR
    -- Committee-specific groups (members of that committee can see)
    EXISTS (
      SELECT 1 FROM committee_members 
      WHERE user_id = auth.uid() 
      AND committee_id::text = group_id
    )
  );

-- Policy: Users can send messages to groups they belong to
CREATE POLICY "Users can send messages to their groups" ON group_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- IIChE main group (everyone can send)
      group_id = 'iiche-main'
      OR
      -- All heads group (only heads can send)
      (group_id = 'all-heads' AND EXISTS (
        SELECT 1 FROM committee_members 
        WHERE user_id = auth.uid() 
        AND position = 'head'
      ))
      OR
      -- All co-heads group (only co-heads can send)
      (group_id = 'all-coheads' AND EXISTS (
        SELECT 1 FROM committee_members 
        WHERE user_id = auth.uid() 
        AND position = 'co_head'
      ))
      OR
      -- Committee-specific groups (members of that committee can send)
      EXISTS (
        SELECT 1 FROM committee_members 
        WHERE user_id = auth.uid() 
        AND committee_id::text = group_id
      )
    )
  );

-- Verify the policies
SELECT 
  policyname, 
  permissive, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'group_messages';
