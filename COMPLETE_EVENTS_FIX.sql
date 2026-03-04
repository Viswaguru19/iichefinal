-- ============================================
-- COMPLETE FIX FOR EVENTS TABLE
-- This fixes ALL issues at once
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- Step 1: Fix the event_date NOT NULL constraint
ALTER TABLE events 
  ALTER COLUMN event_date DROP NOT NULL;

ALTER TABLE events 
  ALTER COLUMN event_date SET DEFAULT NOW();

-- Step 2: Create event_status enum if it doesn't exist
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

-- Step 3: Add ALL missing columns
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

-- Step 4: Copy event_date to date for existing records
UPDATE events 
SET date = event_date 
WHERE date IS NULL AND event_date IS NOT NULL;

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

-- Step 6: Verify everything is set up correctly
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Events table fixed successfully!';
  RAISE NOTICE '✅ event_date constraint removed';
  RAISE NOTICE '✅ All missing columns added';
  RAISE NOTICE '✅ Indexes created';
  RAISE NOTICE '✅ You can now propose events without errors!';
END $$;
