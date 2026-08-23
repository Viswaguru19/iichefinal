-- Migration: Create Message Forwards Tracking Table
-- Description: Track message forwarding for audit and reference
-- Phase 1, Task 1.4

-- Create message_forwards table
CREATE TABLE IF NOT EXISTS message_forwards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  forwarded_to_group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  forwarded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE message_forwards IS 'Tracks message forwarding history';
COMMENT ON COLUMN message_forwards.original_message_id IS 'Original message that was forwarded';
COMMENT ON COLUMN message_forwards.forwarded_to_group_id IS 'Group where message was forwarded to';
COMMENT ON COLUMN message_forwards.forwarded_by IS 'User who forwarded the message';

-- Create indexes
CREATE INDEX idx_message_forwards_original ON message_forwards(original_message_id);
CREATE INDEX idx_message_forwards_target ON message_forwards(forwarded_to_group_id);
CREATE INDEX idx_message_forwards_user ON message_forwards(forwarded_by);

-- Enable Row Level Security
ALTER TABLE message_forwards ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view forwards they have access to
CREATE POLICY "Users can view forwards in accessible groups"
ON message_forwards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.group_id = message_forwards.forwarded_to_group_id
    AND cp.user_id = auth.uid()
  )
);

-- RLS Policy: Users can create forwards
CREATE POLICY "Users can create forwards"
ON message_forwards FOR INSERT
WITH CHECK (forwarded_by = auth.uid());
