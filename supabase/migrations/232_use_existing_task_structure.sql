-- ============================================
-- USE EXISTING TASK STRUCTURE + FIX EVENT STATUS
-- ============================================
-- Works with existing task_assignments table
-- ============================================

-- PART 1: Fix Event Status
-- ============================================

SELECT 'Fixing event statuses...' as info;

UPDATE events
SET status = 'pending_head_approval',
    updated_at = NOW()
WHERE status = 'active'
  AND head_approved_by IS NULL;

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

-- PART 2: Add Missing Columns to task_assignments (if needed)
-- ============================================

-- Add task_updates table for progress tracking
CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES task_assignments(id) ON DELETE CASCADE NOT NULL,
  updated_by UUID REFERENCES profiles(id) NOT NULL,
  update_text TEXT NOT NULL,
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);

-- Enable RLS
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Committee members can view task updates" ON task_updates;
DROP POLICY IF EXISTS "Committee members can add task updates" ON task_updates;

-- RLS for task_updates
CREATE POLICY "Committee members can view task updates"
  ON task_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
      WHERE ta.id = task_updates.task_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
  );

CREATE POLICY "Committee members can add task updates"
  ON task_updates FOR INSERT
  WITH CHECK (
    updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
      WHERE ta.id = task_updates.task_id
        AND cm.user_id = auth.uid()
    )
  );

-- Add internal_assignments table for committee head assignments
CREATE TABLE IF NOT EXISTS internal_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES task_assignments(id) ON DELETE CASCADE NOT NULL,
  assigned_to_user_id UUID REFERENCES profiles(id) NOT NULL,
  assigned_by UUID REFERENCES profiles(id) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(task_id, assigned_to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_internal_assignments_task ON internal_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_internal_assignments_user ON internal_assignments(assigned_to_user_id);

-- Enable RLS
ALTER TABLE internal_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Committee members can view their assignments" ON internal_assignments;
DROP POLICY IF EXISTS "Committee heads can assign internally" ON internal_assignments;

-- RLS for internal_assignments
CREATE POLICY "Committee members can view their assignments"
  ON internal_assignments FOR SELECT
  USING (
    assigned_to_user_id = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
      WHERE ta.id = internal_assignments.task_id
        AND cm.user_id = auth.uid()
        AND cm.position IN ('head', 'co_head')
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
  );

CREATE POLICY "Committee heads can assign internally"
  ON internal_assignments FOR INSERT
  WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
      WHERE ta.id = internal_assignments.task_id
        AND cm.user_id = auth.uid()
        AND cm.position IN ('head', 'co_head')
    )
  );

-- Update RLS policies for task_assignments
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "EC and admins can view all tasks" ON task_assignments;
DROP POLICY IF EXISTS "EC can create tasks" ON task_assignments;
DROP POLICY IF EXISTS "EC and committee heads can update tasks" ON task_assignments;
DROP POLICY IF EXISTS "Committee members can view their tasks" ON task_assignments;

-- Create new policies
CREATE POLICY "EC and admins can view all tasks"
  ON task_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
    OR EXISTS (
      SELECT 1 FROM committee_members 
      WHERE committee_members.user_id = auth.uid() 
      AND committee_members.committee_id = task_assignments.assigned_to_committee
    )
  );

CREATE POLICY "Committee members can create tasks"
  ON task_assignments FOR INSERT
  WITH CHECK (
    assigned_by_user = auth.uid()
    AND EXISTS (
      SELECT 1 FROM committee_members 
      WHERE committee_members.user_id = auth.uid() 
      AND committee_members.committee_id = task_assignments.assigned_by_committee
    )
  );

CREATE POLICY "EC and committee heads can update tasks"
  ON task_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
    OR EXISTS (
      SELECT 1 FROM committee_members 
      WHERE committee_members.user_id = auth.uid() 
      AND committee_members.committee_id = task_assignments.assigned_to_committee
      AND committee_members.position IN ('head', 'co_head')
    )
  );

-- Final verification
SELECT 
  'SETUP COMPLETE!' as status,
  'Event statuses fixed + Task system ready' as message;

SELECT 
  'Tables ready:' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('task_assignments', 'task_updates', 'internal_assignments')
ORDER BY table_name;

SELECT 
  'Task workflow:' as info,
  '1. EC creates task in task_assignments (status: pending)' as step1,
  '2. ANY EC member approves (ec_approved_by set, status: approved)' as step2,
  '3. Committee head assigns internally via internal_assignments' as step3,
  '4. Members update progress via task_updates' as step4,
  '5. Mark complete (completed_at set)' as step5;
