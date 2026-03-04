-- ============================================
-- QUICK FIX: Add missing columns to events table
-- Copy and paste this into Supabase SQL Editor
-- ============================================

-- Add supporting_documents column (this is the main missing one)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS supporting_documents JSONB DEFAULT '[]';

-- Add date column if using 'date' instead of 'event_date'
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;

-- Copy event_date to date if needed
UPDATE events 
SET date = event_date 
WHERE date IS NULL AND event_date IS NOT NULL;

-- Verify the columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('budget', 'supporting_documents', 'date', 'status', 'proposed_by', 'committee_id')
ORDER BY column_name;
