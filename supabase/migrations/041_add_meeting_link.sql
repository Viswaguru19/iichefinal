-- Migration: Add Meeting Link Column
-- Description: Add missing meeting_link column to meetings table

-- Add meeting_link column if it doesn't exist
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add comment
COMMENT ON COLUMN meetings.meeting_link IS 'URL for online meeting (Teams, Meet, Zoom, etc.)';
