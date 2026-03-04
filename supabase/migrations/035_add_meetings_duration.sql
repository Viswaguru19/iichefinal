-- Migration: Add Duration Column to Meetings
-- Description: Add missing duration column to meetings table

-- Add duration column if it doesn't exist
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Add comment
COMMENT ON COLUMN meetings.duration IS 'Meeting duration in minutes';

-- Update existing meetings to have a default duration of 60 minutes
UPDATE meetings
SET duration = 60
WHERE duration IS NULL;
