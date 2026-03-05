-- ============================================
-- TASK APPROVAL SYSTEM - EC APPROVAL + INTERNAL ASSIGNMENT
-- ============================================
-- Workflow:
-- 1. EC creates task → pending_ec_approval
-- 2. 4 EC members approve → task goes to committee (not_started)
-- 3. Committee head can assign internally to specific members
-- 4. Committee members complete tasks
-- ============================================

-- Create task_ec_approvals table (similar to ec_approvals for events)
CREATE TABLE IF NOT EXISTS task_ec_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  approved BOOLEAN DEFAULT TRUE,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_ec_approvals_task ON task_ec_approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_task_ec_approvals_user ON task_ec_approvals(user_id);

-- Enable RLS
ALTER TABLE task_ec_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_ec_approvals
CREATE POLICY "EC members can view task approvals"
  ON task_ec_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.executive_role IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "EC members can approve tasks"
  ON task_ec_approvals FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.executive_role IS NOT NULL
    )
  );

-- Create task_assignments table for internal committee assignments
CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  assigned_to_user_id UUID REFERENCES profiles(id) NOT NULL,
  assigned_by UUID REFERENCES profiles(id) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(task_id, assigned_to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(assigned_to_user_id);

-- Enable RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_assignments
CREATE POLICY "Committee members can view their assignments"
  ON task_assignments FOR SELECT
  USING (
    assigned_to_user_id = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks t
      JOIN committee_members cm ON cm.committee_id = t.assigned_to_committee_id
      WHERE t.id = task_assignments.task_id
        AND cm.user_id = auth.uid()
        AND cm.position IN ('head', 'co_head')
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
  );

CREATE POLICY "Committee heads can assign tasks internally"
  ON task_assignments FOR INSERT
  WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN committee_members cm ON cm.committee_id = t.assigned_to_committee_id
      WHERE t.id = task_assignments.task_id
        AND cm.user_id = auth.uid()
        AND cm.position IN ('head', 'co_head')
    )
  );

-- Add ec_approved_by and ec_approved_at to tasks table if not exists
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS ec_approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS ec_approved_at TIMESTAMPTZ;

-- Verification
SELECT 
  'Task EC approvals table:' as info,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'task_ec_approvals'
ORDER BY ordinal_position;

SELECT 
  'Task assignments table:' as info,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'task_assignments'
ORDER BY ordinal_position;

SELECT 
  'Setup complete!' as info,
  'Task approval system ready: EC approval → Committee → Internal assignment' as message;
