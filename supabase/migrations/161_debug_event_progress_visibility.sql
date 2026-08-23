-- ============================================
-- DEBUG EVENT PROGRESS VISIBILITY
-- ============================================
-- This checks why events without EC approval are showing
-- ============================================

-- Check all events and their statuses
SELECT 
  'All events with status:' as info,
  id,
  title,
  status,
  head_approved_by,
  head_approved_at,
  created_at
FROM events
ORDER BY created_at DESC;

-- Check events that should appear in progress (status = 'active')
SELECT 
  'Events that SHOULD appear in progress:' as info,
  id,
  title,
  status,
  head_approved_by IS NOT NULL as has_head_approval,
  head_approved_at
FROM events
WHERE status = 'active'
ORDER BY created_at DESC;

-- Check events that should NOT appear (not active)
SELECT 
  'Events that should NOT appear:' as info,
  id,
  title,
  status,
  head_approved_by IS NOT NULL as has_head_approval
FROM events
WHERE status != 'active'
ORDER BY created_at DESC;

-- Check EC approvals for all events
SELECT 
  'EC approvals by event:' as info,
  e.id as event_id,
  e.title,
  e.status,
  COUNT(ea.id) as ec_approval_count,
  STRING_AGG(p.name, ', ') as approved_by
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id AND ea.approved = true
LEFT JOIN profiles p ON p.id = ea.user_id
GROUP BY e.id, e.title, e.status
ORDER BY e.created_at DESC;

-- Check if any events have 'active' status without proper EC approval
SELECT 
  'PROBLEM: Active events without enough EC approvals:' as info,
  e.id,
  e.title,
  e.status,
  COUNT(ea.id) as ec_approval_count
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id AND ea.approved = true
WHERE e.status = 'active'
GROUP BY e.id, e.title, e.status
HAVING COUNT(ea.id) < 2
ORDER BY e.created_at DESC;

-- Check workflow config
SELECT 
  'Workflow config:' as info,
  workflow_type,
  config->>'ec_approvals_required' as required_approvals
FROM workflow_config
WHERE workflow_type = 'approval_thresholds';

-- Recommended fix query
SELECT 
  'To fix events with wrong status, run:' as info,
  'UPDATE events SET status = ''pending_ec_approval'' WHERE status = ''active'' AND id IN (' ||
  STRING_AGG(DISTINCT e.id::text, ', ') ||
  ')' as fix_query
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id AND ea.approved = true
WHERE e.status = 'active'
GROUP BY e.id
HAVING COUNT(ea.id) < 2;
