-- ============================================
-- FIX EVENT_DATE NOT NULL CONSTRAINT
-- Run this in Supabase SQL Editor
-- ============================================

-- Option 1: Remove NOT NULL constraint from event_date (safest)
ALTER TABLE events 
  ALTER COLUMN event_date DROP NOT NULL;

-- Option 2: Set a default value for event_date
ALTER TABLE events 
  ALTER COLUMN event_date SET DEFAULT NOW();

-- Now add all the missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM (
      'draft', 'pending_head_approval', 'pending_executive', 
      'pending_faculty_approval', 'faculty_approved', 'approved',
      'in_progress', 'completed', 'cancelled', 'rejected'
    );
  END IF;
END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS supporting_documents JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS status event_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES committees(id),
  ADD COLUMN IF NOT EXISTS head_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS head_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faculty_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS faculty_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finance_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_approved_by UUID REFERENCES profiles(id);

-- Copy event_date to date for existing records
UPDATE events SET date = event_date WHERE date IS NULL AND event_date IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('event_date', 'date', 'budget', 'proposed_by', 'status')
ORDER BY column_name;
