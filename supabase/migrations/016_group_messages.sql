-- Create group_messages table
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_created ON group_messages(created_at);

-- Enable RLS
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read messages from their groups
CREATE POLICY "Users can read group messages"
  ON group_messages FOR SELECT
  USING (true);

-- Allow users to send messages
CREATE POLICY "Users can send group messages"
  ON group_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Add read status to direct_messages
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
