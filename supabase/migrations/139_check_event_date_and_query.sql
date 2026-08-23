-- ============================================
-- CHECK EVENT DATE AND SIMULATE QUERIES
-- ============================================

-- Show the event with its date
SELECT 
  '📅 YOUR EVENT' as section,
  id,
  title,
  status,
  date,
  date > NOW() as is_future_event,
  created_at
FROM events
WHERE status = 'active'
ORDER BY created_at DESC;

-- Simulate HOMEPAGE query (future events only)
SELECT 
  '🏠 HOMEPAGE QUERY (future events)' as section,
  id,
  title,
  status,
  date,
  created_at
FROM events
WHERE status = 'active'
  AND date >= NOW()
ORDER BY date ASC
LIMIT 5;

-- Simulate EVENT PROGRESS query (all active events, ordered by date desc)
SELECT 
  '📊 EVENT PROGRESS QUERY (all active)' as section,
  id,
  title,
  status,
  date,
  created_at
FROM events
WHERE status = 'active'
ORDER BY date DESC;

-- Check if there are any NULL dates
SELECT 
  '⚠️ NULL DATE CHECK' as section,
  id,
  title,
  status,
  date IS NULL as has_null_date,
  date
FROM events
WHERE status = 'active';
