-- ============================================
-- QUICK EVENT STATUS CHECK
-- ============================================
-- Run this to see what your event needs
-- ============================================

-- 1. Your event
SELECT 
  '📋 YOUR EVENT' as "Info",
  title as "Title",
  status as "Status",
  CASE 
    WHEN head_approved_by IS NULL THEN '❌ NO'
    ELSE '✅ YES'
  END as "Head Approved?",
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as "EC Approvals",
  date as "Event Date"
FROM events
ORDER BY created_at DESC
LIMIT 1;

-- 2. Required EC approvals
SELECT 
  '⚙️ CONFIG' as "Info",
  COALESCE(
    (SELECT (config->>'ec_approvals_required')::INTEGER 
     FROM workflow_config 
     WHERE workflow_type = 'approval_thresholds'), 
    2
  ) as "EC Approvals Required";

-- 3. What to do next
SELECT 
  '🎯 NEXT STEP' as "Info",
  CASE 
    WHEN e.head_approved_by IS NULL THEN 
      'Committee Head must approve in Proposals page'
    WHEN (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true) < 
         COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2)
    THEN 
      'Need ' || 
      (COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2) - 
       (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true))::TEXT || 
      ' more EC approval(s) in Proposals page'
    WHEN e.status != 'active' THEN
      'Run FIX_EVENT_STATUS_RESPECT_CONFIG.sql to activate'
    ELSE 
      'Event is active! Check Event Progress page'
  END as "Action Needed"
FROM events e
ORDER BY e.created_at DESC
LIMIT 1;
