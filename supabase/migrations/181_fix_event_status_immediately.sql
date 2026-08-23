-- ============================================
-- FIX EVENT STATUS - REMOVE UNAPPROVED EVENTS FROM PROGRESS
-- ============================================
-- This fixes events that are marked 'active' without proper EC approval
-- ============================================

-- First, let's see what we're fixing
SELECT 
  'Events that will be fixed:' as info,
  e.id,
  e.title,
  e.status as current_status,
  COUNT(ea.id) as ec_approval_count,
  CASE 
    WHEN e.head_approved_by IS NULL THEN 'pending_head_approval'
    WHEN COUNT(ea.id) < 2 THEN 'pending_ec_approval'
    ELSE 'active'
  END as correct_status
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id AND ea.approved = true
WHERE e.status = 'active'
GROUP BY e.id, e.title, e.status, e.head_approved_by
HAVING COUNT(ea.id) < 2 OR e.head_approved_by IS NULL;

-- Fix events that are 'active' but don't have head approval
UPDATE events
SET status = 'pending_head_approval'
WHERE status = 'active'
  AND head_approved_by IS NULL;

-- Fix events that are 'active' but don't have enough EC approvals
-- Get the required approval count from config (default 2)
DO $$
DECLARE
  required_approvals INTEGER;
BEGIN
  -- Get required approvals from config
  SELECT COALESCE(
    (config->>'ec_approvals_required')::INTEGER,
    2
  ) INTO required_approvals
  FROM workflow_config
  WHERE workflow_type = 'approval_thresholds';

  -- If no config found, use default of 2
  IF required_approvals IS NULL THEN
    required_approvals := 2;
  END IF;

  -- Update events that don't have enough EC approvals
  UPDATE events e
  SET status = 'pending_ec_approval'
  WHERE e.status = 'active'
    AND e.head_approved_by IS NOT NULL
    AND (
      SELECT COUNT(*)
      FROM ec_approvals ea
      WHERE ea.event_id = e.id
        AND ea.approved = true
    ) < required_approvals;

  RAISE NOTICE 'Fixed events with less than % EC approvals', required_approvals;
END $$;

-- Verify the fix
SELECT 
  'After fix - Events by status:' as info,
  status,
  COUNT(*) as count
FROM events
GROUP BY status
ORDER BY status;

-- Show active events with their approval counts
SELECT 
  'Active events (should all have proper approvals):' as info,
  e.id,
  e.title,
  e.status,
  e.head_approved_by IS NOT NULL as has_head_approval,
  COUNT(ea.id) as ec_approval_count
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id AND ea.approved = true
WHERE e.status = 'active'
GROUP BY e.id, e.title, e.status, e.head_approved_by
ORDER BY e.created_at DESC;

-- Success message
SELECT 
  'Fix complete!' as info,
  'Only properly approved events will now appear in Event Progress' as message;
