-- ============================================
-- ADD MISSING COLUMNS TO EVENTS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add budget column if it doesn't exist (should already exist from migration 023)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS budget DECIMAL(10,2);

-- Add supporting_documents column for file attachments
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS supporting_documents JSONB DEFAULT '[]';

-- Add date column (rename event_date to date for consistency)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;

-- Copy data from event_date to date if event_date exists
UPDATE events SET date = event_date WHERE date IS NULL AND event_date IS NOT NULL;

-- Add committee_id if it doesn't exist (should already exist)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES committees(id);

-- Add proposed_by if it doesn't exist (should already exist from migration 023)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES profiles(id);

-- Add status if it doesn't exist (should already exist from migration 023)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM (
      'draft',
      'pending_head_approval',
      'pending_executive',
      'pending_faculty_approval',
      'faculty_approved',
      'approved',
      'in_progress',
      'completed',
      'cancelled',
      'rejected'
    );
  END IF;
END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status event_status DEFAULT 'draft';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Verify the changes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;
