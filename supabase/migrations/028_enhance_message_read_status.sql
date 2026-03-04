-- Migration: Enhance Message Read Status Table
-- Description: Add delivered_at column to track delivery separately from read status
-- Phase 1, Task 1.3

-- Add delivered_at column
ALTER TABLE message_read_status
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Update existing records to set delivered_at = created_at
UPDATE message_read_status
SET delivered_at = created_at
WHERE delivered_at IS NULL;

-- Add comment
COMMENT ON COLUMN message_read_status.delivered_at IS 'Timestamp when message was delivered to user';

-- Create index for delivery tracking
CREATE INDEX IF NOT EXISTS idx_message_read_status_delivered 
ON message_read_status(message_id, delivered_at);

-- Add constraint: read_at must be >= delivered_at
ALTER TABLE message_read_status
ADD CONSTRAINT check_read_after_delivered
CHECK (read_at IS NULL OR delivered_at IS NULL OR read_at >= delivered_at);
