-- ============================================
-- DIAGNOSE EVENT VISIBILITY ISSUE
-- ============================================
-- This checks why events aren't showing in Event Progress
-- ============================================

-- Step 1: Check workflow config settings
SELECT 
  '=== WORKFLOW CONFIG ===' as section,
  workflow_type,
  config->>'ec_approvals_required' as ec_approvals_required,
  config->>'head_approvals_required' as head_approvals_required,
  config->>'ec_approval_mode' as ec_approval_mode
FROM workflow_config
WHERE workflow_type = 'approval_thresholds';

-- Step 2: Check all events and their approval status
SELECT 
  '=== ALL EVENTS ===' as section,
  id,
  title,
  status,
  head_approved_by IS NOT NULL as has_head_approval,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approval_count,
  created_at
FROM events
ORDER BY created_at DESC;

-- Step 3: Check EC approvals for each event
SELECT 
  '=== EC APPROVALS DETAIL ===' as section,
  e.title as event_title,
  e.status as event_status,
  p.name as ec_member_name,
  p.executive_role as ec_role,
  ea.approved,
  ea.created_at as approval_date
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id
LEFT JOIN profiles p ON p.id = ea.user_id
ORDER BY e.created_at DESC, ea.created_at;

-- Step 4: Show what needs to happen for each event
SELECT 
  '=== WHAT EACH EVENT NEEDS ===' as section,
  e.title,
  e.status,
  CASE 
    WHEN e.head_approved_by IS NULL THEN '❌ Needs committee head approval'
    WHEN (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true) < 
         COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2)
    THEN '❌ Needs ' || 
         (COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2) - 
          (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true)) || 
         ' more EC approval(s)'
    ELSE '✅ Ready to be active'
  END as status_message,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true) as current_ec_approvals,
  COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2) as required_ec_approvals
FROM events e
ORDER BY e.created_at DESC;

-- Step 5: Show EC members who can approve
SELECT 
  '=== EC MEMBERS WHO CAN APPROVE ===' as section,
  name,
  executive_role,
  email
FROM profiles
WHERE executive_role IN ('secretary', 'associate_secretary', 'joint_secretary', 'associate_joint_secretary')
ORDER BY 
  CASE executive_role
    WHEN 'secretary' THEN 1
    WHEN 'associate_secretary' THEN 2
    WHEN 'joint_secretary' THEN 3
    WHEN 'associate_joint_secretary' THEN 4
  END;

-- Step 6: Provide action items
SELECT 
  '=== ACTION ITEMS ===' as section,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM workflow_config WHERE workflow_type = 'approval_thresholds')
    THEN '1. Run ADD_WORKFLOW_CONFIG_SETTINGS.sql to create workflow config'
    WHEN EXISTS (SELECT 1 FROM events WHERE head_approved_by IS NULL)
    THEN '2. Committee heads need to approve their events in Proposals page'
    WHEN EXISTS (
      SELECT 1 FROM events e 
      WHERE head_approved_by IS NOT NULL 
      AND (SELECT COUNT(*) FROM ec_approvals WHERE event_id = e.id AND approved = true) < 
          COALESCE((SELECT (config->>'ec_approvals_required')::INTEGER FROM workflow_config WHERE workflow_type = 'approval_thresholds'), 2)
    )
    THEN '3. EC members need to approve events in Proposals page'
    WHEN EXISTS (SELECT 1 FROM events WHERE status != 'active' AND head_approved_by IS NOT NULL)
    THEN '4. Run FIX_EVENT_STATUS_RESPECT_CONFIG.sql to update event statuses'
    ELSE '5. All events should be visible in Event Progress now!'
  END as next_step;
