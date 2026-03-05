-- ============================================
-- FIX ALL MISSING COLUMNS IN EVENTS TABLE
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- First, let's see what columns currently exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- Create event_status enum if it doesn't exist
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

-- Add ALL missing columns
ALTER TABLE events
  -- Basic event info
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS supporting_documents JSONB DEFAULT '[]',
  
  -- Workflow columns
  ADD COLUMN IF NOT EXISTS status event_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES committees(id),
  
  -- Approval tracking
  ADD COLUMN IF NOT EXISTS head_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS head_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faculty_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS faculty_approved_at TIMESTAMPTZ,
  
  -- Finance
  ADD COLUMN IF NOT EXISTS finance_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_approved_by UUID REFERENCES profiles(id);

-- Copy event_date to date if event_date exists and date is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'event_date'
  ) THEN
    UPDATE events 
    SET date = event_date 
    WHERE date IS NULL AND event_date IS NOT NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_proposed_by ON events(proposed_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Verify all columns now exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN (
    'id', 'title', 'description', 'date', 'location', 
    'budget', 'supporting_documents', 'status', 
    'proposed_by', 'committee_id',
    'head_approved_by', 'head_approved_at',
    'faculty_approved_by', 'faculty_approved_at',
    'finance_approved', 'finance_approved_by',
    'created_at', 'updated_at'
  )
ORDER BY column_name;

-- Show success message
DO $$
BEGIN
  RAISE NOTICE 'All columns added successfully! Check the results above.';
END $$;
