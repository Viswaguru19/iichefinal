-- Check what events actually exist and their approval status
SELECT 
  'All events:' as info,
  id,
  title,
  status,
  head_approved_by IS NOT NULL as has_head_approval,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approvals,
  created_at
FROM events
ORDER BY created_at DESC;

-- Check if there are ANY events at all
SELECT 
  'Total events in database:' as info,
  COUNT(*) as count
FROM events;
