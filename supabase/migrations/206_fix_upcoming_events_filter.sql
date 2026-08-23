-- Fix Upcoming Events to Show Only Approved Events
-- This ensures only fully approved events appear in upcoming events sections

-- Step 1: Check current event statuses
SELECT 
  status,
  COUNT(*) as count,
  STRING_AGG(title, ', ') as event_titles
FROM events
GROUP BY status
ORDER BY count DESC;

-- Step 2: Update any events that should be active
-- Events that have been faculty approved should have status = 'active'
UPDATE events
SET status = 'active'
WHERE faculty_approved_by IS NOT NULL
  AND faculty_approved_at IS NOT NULL
  AND status != 'active'
  AND status != 'cancelled'
  AND status != 'completed';

-- Step 3: Verify the fix
SELECT 
  id,
  title,
  status,
  date,
  event_date,
  head_approved_by IS NOT NULL as head_approved,
  faculty_approved_by IS NOT NULL as faculty_approved
FROM events
WHERE date >= NOW() OR event_date >= NOW()
ORDER BY COALESCE(date, event_date);

-- Step 4: Show what will appear in "Upcoming Events"
SELECT 
  title,
  status,
  COALESCE(date, event_date) as event_datetime,
  committee_id
FROM events
WHERE status = 'active'
  AND (date >= NOW() OR event_date >= NOW())
ORDER BY COALESCE(date, event_date)
LIMIT 10;

-- Expected: Only events with status = 'active' should appear
