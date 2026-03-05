-- ============================================
-- FIX EVENT STATUS - RESPECT WORKFLOW CONFIG
-- ============================================
-- Updates events to 'active' based on workflow_config settings
-- ============================================

DO $$
DECLARE
  required_approvals INTEGER;
BEGIN
  -- Get required approvals from workflow config (default 2 if not set)
  SELECT COALESCE(
    (config->>'ec_approvals_required')::INTEGER,
    2
  ) INTO required_approvals
  FROM workflow_config
  WHERE workflow_type = 'approval_thresholds'
  LIMIT 1;

  -- If no config found, use default of 2
  IF required_approvals IS NULL THEN
    required_approvals := 2;
  END IF;

  RAISE NOTICE 'Using % EC approvals as required (from workflow config)', required_approvals;

  -- Update events that meet the requirements
  UPDATE events 
  SET status = 'active', 
      updated_at = NOW()
  WHERE head_approved_by IS NOT NULL 
    AND (
      SELECT COUNT(*) 
      FROM ec_approvals 
      WHERE event_id = events.id 
        AND approved = true
    ) >= required_approvals
    AND status != 'active';

END $$;

-- Show results
SELECT 
  'Events now active:' as info,
  id,
  title,
  status,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approvals
FROM events
WHERE status = 'active'
ORDER BY created_at DESC;

-- Show workflow config
SELECT 
  'Workflow config used:' as info,
  config->>'ec_approvals_required' as required_ec_approvals
FROM workflow_config
WHERE workflow_type = 'approval_thresholds';

SELECT 'Done! Refresh Event Progress page.' as message;
