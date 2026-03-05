-- ============================================
-- ADD SPECIAL CHAT GROUPS
-- Run this in Supabase SQL Editor
-- ============================================

-- The group_messages table should already exist from previous migrations
-- We just need to ensure it supports special group IDs

-- Check if group_messages table exists, if not create it
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id TEXT NOT NULL,  -- Changed from UUID to TEXT to support special IDs like 'all-heads'
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created ON group_messages(created_at DESC);

-- Add RLS policies for group messages
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages in their groups" ON group_messages;
DROP POLICY IF EXISTS "Users can send messages to their groups" ON group_messages;

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
  );

-- Verify the setup
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'group_messages';
