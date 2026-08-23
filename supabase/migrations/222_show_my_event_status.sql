-- ============================================
-- SHOW MY EVENT STATUS - SIMPLE VIEW
-- ============================================
-- Quick view of what your event needs
-- ============================================

-- Your event details
SELECT 
  '📋 YOUR EVENT' as info,
  title,
  status,
  CASE 
    WHEN head_approved_by IS NULL THEN '❌ NOT APPROVED'
    ELSE '✅ APPROVED'
  END as head_approval_status,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approvals_received,
  created_at
FROM events
ORDER BY created_at DESC
LIMIT 1;

-- What's configured
SELECT 
  '⚙️ WORKFLOW CONFIG' as info,
  COALESCE(
    (SELECT (config->>'ec_approvals_required')::INTEGER 
     FROM workflow_config 
     WHERE workflow_type = 'approval_thresholds'), 
    2
  ) as ec_approvals_required;

-- What needs to happen
SELECT 
  '🎯 NEXT STEPS' as info,
  CASE 
    WHEN e.head_approved_by IS NULL THEN 
      '1️⃣ Committee Head needs to approve in Proposals page'
    WHEN (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true) < 
         COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2)
    THEN 
      '2️⃣ Need ' || 
      (COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2) - 
       (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true)) || 
      ' more EC approval(s) in Proposals page'
    WHEN e.status != 'active' THEN
      '3️⃣ Run FIX_EVENT_STATUS_RESPECT_CONFIG.sql to activate event'
    ELSE 
      '✅ Event is active! Check Event Progress page'
  END as action_needed
FROM events e
ORDER BY e.created_at DESC
LIMIT 1;

-- EC members who can approve
SELECT 
  '👥 EC MEMBERS WHO CAN APPROVE' as info,
  name,
  executive_role,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM ec_approvals ea 
      JOIN events e ON e.id = ea.event_id 
      WHERE ea.user_id = profiles.id 
      AND ea.approved = true
      ORDER BY e.created_at DESC
      LIMIT 1
    ) THEN '✅ Already approved'
    ELSE '⏳ Can approve'
  END as approval_status
FROM profiles
WHERE executive_role IN ('secretary', 'associate_secretary', 'joint_secretary', 'associate_joint_secretary')
ORDER BY 
  CASE executive_role
    WHEN 'secretary' THEN 1
    WHEN 'associate_secretary' THEN 2
    WHEN 'joint_secretary' THEN 3
    WHEN 'associate_joint_secretary' THEN 4
  END;
