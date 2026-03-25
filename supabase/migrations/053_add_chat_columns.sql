-- Add missing columns to direct_messages and group_messages for polls and file attachments
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS poll_data JSONB;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS poll_data JSONB;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS file_url TEXT;
