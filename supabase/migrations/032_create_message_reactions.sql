-- Migration: Create Message Reactions Table
-- Description: Enable emoji reactions on messages
-- Phase 1, Task 1.2

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Add comments
COMMENT ON TABLE message_reactions IS 'Stores emoji reactions to messages';
COMMENT ON COLUMN message_reactions.message_id IS 'Reference to the message being reacted to';
COMMENT ON COLUMN message_reactions.user_id IS 'User who added the reaction';
COMMENT ON COLUMN message_reactions.emoji IS 'Unicode emoji character';

-- Create indexes for performance
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_id);
CREATE INDEX idx_message_reactions_emoji ON message_reactions(message_id, emoji);

-- Enable Row Level Security
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view reactions on messages they can see
CREATE POLICY "Users can view reactions on accessible messages"
ON message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_participants cp ON cp.group_id = cm.group_id
    WHERE cm.id = message_reactions.message_id
    AND cp.user_id = auth.uid()
  )
);

-- RLS Policy: Users can add reactions to messages they can see
CREATE POLICY "Users can add reactions to accessible messages"
ON message_reactions FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_participants cp ON cp.group_id = cm.group_id
    WHERE cm.id = message_reactions.message_id
    AND cp.user_id = auth.uid()
  )
);

-- RLS Policy: Users can update their own reactions
CREATE POLICY "Users can update their own reactions"
ON message_reactions FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
ON message_reactions FOR DELETE
USING (user_id = auth.uid());
