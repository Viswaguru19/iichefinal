-- ============================================
-- CHECK EVENT STATUS ISSUE
-- ============================================
-- This checks the actual status of events in the database
-- ============================================

-- Check the most recent event and its status
SELECT 
  'Most recent event:' as info,
  id,
  title,
  status,
  proposed_by,
  head_approved_by,
  head_approved_at,
  created_at,
  updated_at
FROM events
ORDER BY created_at DESC
LIMIT 5;

-- Check EC approvals for recent events
SELECT 
  'EC approvals for recent events:' as info,
  e.id as event_id,
  e.title,
  e.status,
  COUNT(ea.id) FILTER (WHERE ea.approved = true) as approval_count,
  STRING_AGG(p.name, ', ') FILTER (WHERE ea.approved = true) as approved_by_names
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id
LEFT JOIN profiles p ON p.id = ea.user_id
GROUP BY e.id, e.title, e.status
ORDER BY e.created_at DESC
LIMIT 5;

-- Check if there are any events with status 'active' that shouldn't be
SELECT 
  'Events with ACTIVE status:' as info,
  id,
  title,
  status,
  head_approved_by IS NOT NULL as has_head_approval,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approval_count,
  created_at
FROM events
WHERE status = 'active'
ORDER BY created_at DESC;

-- Check if there are events with wrong status
SELECT 
  'Events with PENDING status (should not show in progress):' as info,
  id,
  title,
  status,
  created_at
FROM events
WHERE status IN ('pending_head_approval', 'pending_ec_approval')
ORDER BY created_at DESC;
