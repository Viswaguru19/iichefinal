-- Add new fields to events table for proposals
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_duration TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS expected_participants INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_fee TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS prize TEXT;
