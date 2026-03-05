-- ============================================
-- CHECK WHY NO EVENTS SHOWING IN PROGRESS
-- ============================================

-- Check all events and their statuses
SELECT 
  'All events in database:' as info,
  id,
  title,
  status,
  head_approved_by IS NOT NULL as has_head_approval,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approval_count,
  created_at
FROM events
ORDER BY created_at DESC;

-- Check specifically for active events
SELECT 
  'Events with status = active:' as info,
  COUNT(*) as count
FROM events
WHERE status = 'active';

-- Check events that SHOULD be active
SELECT 
  'Events that should be active (have approvals):' as info,
  e.id,
  e.title,
  e.status as current_status,
  e.head_approved_by IS NOT NULL as has_head_approval,
  COUNT(ea.id) as ec_approval_count
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id AND ea.approved = true
WHERE e.head_approved_by IS NOT NULL
GROUP BY e.id, e.title, e.status, e.head_approved_by
HAVING COUNT(ea.id) >= 2;

-- Check workflow config
SELECT 
  'Workflow config:' as info,
  config->>'ec_approvals_required' as required_approvals
FROM workflow_config
WHERE workflow_type = 'approval_thresholds';

-- Suggest fix
SELECT 
  'If events exist but status is wrong, run this:' as suggestion,
  'UPDATE events SET status = ''active'' WHERE head_approved_by IS NOT NULL AND (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) >= 2;' as sql_to_run;
