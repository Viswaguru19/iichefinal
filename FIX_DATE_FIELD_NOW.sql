-- ============================================
-- FIX DATE FIELD ISSUE
-- Add 'date' as an alias for 'event_date'
-- ============================================

-- This allows the frontend to use either 'date' or 'event_date'
-- without breaking existing code

-- Option 1: Add a generated column (PostgreSQL 12+)
-- This creates a real column that's automatically computed
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ 
GENERATED ALWAYS AS (event_date) STORED;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_events_date_alias ON events(date);

-- Verify the change
SELECT 
  'Date field added successfully' as status,
  COUNT(*) as total_events,
  COUNT(date) as events_with_date,
  COUNT(event_date) as events_with_event_date
FROM events;

-- Show sample data
SELECT 
  id,
  title,
  event_date,
  date,
  'Both fields should match' as note
FROM events
LIMIT 5;
