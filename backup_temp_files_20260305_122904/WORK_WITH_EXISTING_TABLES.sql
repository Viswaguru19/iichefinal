-- ============================================
-- WORK WITH EXISTING TABLES - FIX EVENT STATUS ONLY
-- ============================================
-- This assumes task tables already exist
-- We'll just fix event status and check what's there
-- ============================================

-- PART 1: Fix Event Status
-- ============================================

SELECT 'Fixing event statuses...' as info;

-- Fix events that are 'active' but don't have head approval
UPDATE events
SET status = 'pending_head_approval',
    updated_at = NOW()
WHERE status = 'active'
  AND head_approved_by IS NULL;

-- Fix events that are 'active' but don't have enough EC approvals
UPDATE events e
SET status = 'pending_ec_approval',
    updated_at = NOW()
WHERE e.status = 'active'
  AND e.head_approved_by IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM ec_approvals ea
    WHERE ea.event_id = e.id
      AND ea.approved = true
  ) < COALESCE(
    (SELECT (config->>'ec_approvals_required')::INTEGER 
     FROM workflow_config 
     WHERE workflow_type = 'approval_thresholds' 
     LIMIT 1),
    2
  );

SELECT 
  'Events fixed - Status summary:' as info,
  status,
  COUNT(*) as count
FROM events
GROUP BY status
ORDER BY status;

-- PART 2: Check Existing Task Tables
-- ============================================

SELECT 'Checking existing task tables...' as info;

-- Show existing tables
SELECT 
  'Existing task-related tables:' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%task%'
ORDER BY table_name;

-- Show tasks table structure if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    RAISE NOTICE 'Tasks table exists with columns:';
  ELSE
    RAISE NOTICE 'Tasks table does NOT exist - needs to be created';
  END IF;
END $$;

SELECT 
  'Tasks table columns (if exists):' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- Show task_updates table structure if it exists
SELECT 
  'Task_updates table columns (if exists):' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'task_updates'
ORDER BY ordinal_position;

-- Show task_assignments table structure if it exists
SELECT 
  'Task_assignments table columns (if exists):' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'task_assignments'
ORDER BY ordinal_position;

-- Check if task_status enum exists
SELECT 
  'Task status enum values (if exists):' as info,
  e.enumlabel as status_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'task_status'
ORDER BY e.enumsortorder;

SELECT 
  'DONE!' as status,
  'Event statuses fixed. Check output above to see what task tables exist.' as message,
  'If tasks table does NOT exist, we need to create it from scratch.' as next_step;
