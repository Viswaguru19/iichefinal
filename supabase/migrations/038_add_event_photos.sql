-- Migration: Add Event Photos
-- Description: Add photo columns to events table
-- Phase 1, Task 1.2

-- Add photo columns to events
ALTER TABLE events
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cover_photo TEXT,
ADD COLUMN IF NOT EXISTS gallery_album_id UUID REFERENCES gallery_albums(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_events_gallery_album ON events(gallery_album_id);

-- Comments
COMMENT ON COLUMN events.photos IS 'Array of photo URLs for the event';
COMMENT ON COLUMN events.cover_photo IS 'Main cover photo URL for the event';
COMMENT ON COLUMN events.gallery_album_id IS 'Link to dedicated photo album for this event';
