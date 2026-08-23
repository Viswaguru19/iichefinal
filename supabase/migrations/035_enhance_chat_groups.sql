-- Migration: Enhance Chat Groups Table
-- Description: Add mute functionality columns
-- Phase 1, Task 1.5

-- Add mute columns to chat_groups table
ALTER TABLE chat_groups
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN chat_groups.is_muted IS 'Flag indicating if group is muted';
COMMENT ON COLUMN chat_groups.muted_until IS 'Timestamp when mute expires (NULL for indefinite)';

-- Create index for muted groups
CREATE INDEX IF NOT EXISTS idx_chat_groups_muted 
ON chat_groups(is_muted, muted_until) 
WHERE is_muted = true;

-- Add constraint: muted_until must be in future if is_muted is true
ALTER TABLE chat_groups
ADD CONSTRAINT check_mute_until_future
CHECK (
  NOT is_muted 
  OR muted_until IS NULL 
  OR muted_until > NOW()
);
