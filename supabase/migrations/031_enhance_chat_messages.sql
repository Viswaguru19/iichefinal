-- Migration: Enhance Chat Messages Table
-- Description: Add columns for file metadata, edit tracking, and message pinning
-- Phase 1, Task 1.1

-- Add new columns to chat_messages table
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN chat_messages.file_name IS 'Original filename for uploaded files';
COMMENT ON COLUMN chat_messages.file_size IS 'File size in bytes';
COMMENT ON COLUMN chat_messages.is_edited IS 'Flag indicating if message was edited';
COMMENT ON COLUMN chat_messages.edited_at IS 'Timestamp of last edit';
COMMENT ON COLUMN chat_messages.is_pinned IS 'Flag indicating if message is pinned';
COMMENT ON COLUMN chat_messages.pinned_by IS 'User who pinned the message';
COMMENT ON COLUMN chat_messages.pinned_at IS 'Timestamp when message was pinned';

-- Create index for pinned messages (for efficient queries)
CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned 
ON chat_messages(group_id, is_pinned) 
WHERE is_pinned = true;

-- Create index for edited messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_edited 
ON chat_messages(group_id, is_edited) 
WHERE is_edited = true;
