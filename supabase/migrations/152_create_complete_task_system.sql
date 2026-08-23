-- ============================================
-- CREATE COMPLETE TASK SYSTEM
-- ============================================
-- Creates tasks table + EC approval + internal assignment system
-- ============================================

-- Create task status enum
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'pending_ec_approval',
    'ec_rejected',
    'not_started',
    'in_progress',
    'partially_completed',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create task priority enum
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  assigned_to_committee_id UUID REFERENCES committees(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'pending_ec_approval',
  priority task_priority DEFAULT 'medium',
  created_by UUID REFERENCES profiles(id) NOT NULL,
  ec_approved_by UUID REFERENCES profiles(id),
  ec_approved_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_event ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_committee ON tasks(assigned_to_committee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "EC and admins can view all tasks"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
    OR EXISTS (
      SELECT 1 FROM committee_members 
      WHERE committee_members.user_id = auth.uid() 
      AND committee_members.committee_id = tasks.assigned_to_committee_id
    )
  );

CREATE POLICY "EC can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.executive_role IS NOT NULL
    )
  );

CREATE POLICY "EC and committee heads can update tasks"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
    OR EXISTS (
      SELECT 1 FROM committee_members 
      WHERE committee_members.user_id = auth.uid() 
      AND committee_members.committee_id = tasks.assigned_to_committee_id
      AND committee_members.position IN ('head', 'co_head')
    )
  );

-- Create task_updates table
CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  update_text TEXT NOT NULL,
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);

-- Enable RLS
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

-- RLS for task_updates
CREATE POLICY "Committee members can view task updates"
  ON task_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN committee_members cm ON cm.committee_id = t.assigned_to_committee_id
      WHERE t.id = task_updates.task_id
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
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN committee_members cm ON cm.committee_id = t.assigned_to_committee_id
      WHERE t.id = task_updates.task_id
        AND cm.user_id = auth.uid()
    )
  );

-- Create task_ec_approvals table
CREATE TABLE IF NOT EXISTS task_ec_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  ec_member_id UUID REFERENCES profiles(id) NOT NULL,
  approved BOOLEAN DEFAULT TRUE,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, ec_member_id)
);

CREATE INDEX IF NOT EXISTS idx_task_ec_approvals_task ON task_ec_approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_task_ec_approvals_member ON task_ec_approvals(ec_member_id);

-- Enable RLS
ALTER TABLE task_ec_approvals ENABLE ROW LEVEL SECURITY;

-- RLS for task_ec_approvals
CREATE POLICY "EC members can view and manage task approvals"
  ON task_ec_approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
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

-- RLS for task_assignments
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

-- Verification
SELECT 
  'Tasks table created:' as info,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'tasks';

SELECT 
  'Task system complete!' as info,
  'Tables created: tasks, task_updates, task_ec_approvals, task_assignments' as message;
