-- ============================================
-- VERIFY EVENT IS REALLY ACTIVE
-- ============================================
-- Double-check the event status
-- ============================================

-- Show the actual event with all details
SELECT 
  '📋 EVENT DETAILS' as section,
  id,
  title,
  status,
  date,
  head_approved_by IS NOT NULL as has_head_approval,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approval_count,
  created_at,
  updated_at
FROM events
ORDER BY created_at DESC;

-- Check if status is EXACTLY 'active'
SELECT 
  '🔍 STATUS CHECK' as section,
  status,
  status = 'active' as is_exactly_active,
  CASE 
    WHEN status = 'active' THEN '✅ Status is correct'
    ELSE '❌ Status is: ' || status
  END as status_message
FROM events
ORDER BY created_at DESC
LIMIT 1;

-- Show what Event Progress page will see
SELECT 
  '👁️ WHAT EVENT PROGRESS SEES' as section,
  id,
  title,
  status,
  date
FROM events
WHERE status = 'active'
ORDER BY date DESC;

-- Count events by status
SELECT 
  '📊 EVENTS BY STATUS' as section,
  status,
  COUNT(*) as count
FROM events
GROUP BY status;
