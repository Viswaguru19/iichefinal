-- ============================================
-- COMPLETE FIX FOR EVENT PROGRESS AND TASK SYSTEM
-- ============================================
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- PART 1: Fix Event Status (Remove unapproved events from progress)
-- ============================================

-- Check current situation
SELECT 
  'BEFORE FIX - Events by status:' as info,
  status,
  COUNT(*) as count
FROM events
GROUP BY status
ORDER BY status;

-- Fix events that are 'active' but don't have head approval
UPDATE events
SET status = 'pending_head_approval',
    updated_at = NOW()
WHERE status = 'active'
  AND head_approved_by IS NULL;

-- Fix events that are 'active' but don't have enough EC approvals
DO $$
DECLARE
  required_approvals INTEGER;
  fixed_count INTEGER := 0;
BEGIN
  -- Get required approvals from config (default 2)
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

  -- Update events that don't have enough EC approvals
  WITH events_to_fix AS (
    SELECT e.id
    FROM events e
    WHERE e.status = 'active'
      AND e.head_approved_by IS NOT NULL
      AND (
        SELECT COUNT(*)
        FROM ec_approvals ea
        WHERE ea.event_id = e.id
          AND ea.approved = true
      ) < required_approvals
  )
  UPDATE events
  SET status = 'pending_ec_approval',
      updated_at = NOW()
  FROM events_to_fix
  WHERE events.id = events_to_fix.id;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  RAISE NOTICE 'Fixed % events with less than % EC approvals', fixed_count, required_approvals;
END $$;

-- Show results
SELECT 
  'AFTER FIX - Events by status:' as info,
  status,
  COUNT(*) as count
FROM events
GROUP BY status
ORDER BY status;

-- Show which events are now active (should only be properly approved ones)
SELECT 
  'Active events (properly approved):' as info,
  e.title,
  e.status,
  COUNT(ea.id) FILTER (WHERE ea.approved = true) as ec_approvals
FROM events e
LEFT JOIN ec_approvals ea ON ea.event_id = e.id
WHERE e.status = 'active'
GROUP BY e.id, e.title, e.status
ORDER BY e.created_at DESC;

-- PART 2: Create Complete Task System
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "EC and admins can view all tasks" ON tasks;
DROP POLICY IF EXISTS "EC can create tasks" ON tasks;
DROP POLICY IF EXISTS "EC and committee heads can update tasks" ON tasks;

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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Committee members can view task updates" ON task_updates;
DROP POLICY IF EXISTS "Committee members can add task updates" ON task_updates;

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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "EC members can view task approvals" ON task_ec_approvals;
DROP POLICY IF EXISTS "EC members can manage their task approvals" ON task_ec_approvals;

-- RLS for task_ec_approvals
CREATE POLICY "EC members can view task approvals"
  ON task_ec_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.executive_role IS NOT NULL OR profiles.is_admin = TRUE)
    )
  );

CREATE POLICY "EC members can manage their task approvals"
  ON task_ec_approvals FOR INSERT
  WITH CHECK (
    ec_member_id = auth.uid()
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Committee members can view their assignments" ON task_assignments;
DROP POLICY IF EXISTS "Committee heads can assign tasks internally" ON task_assignments;

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

-- Final verification
SELECT 
  'SETUP COMPLETE!' as status,
  'Event status fixed + Task system created' as message;

SELECT 
  'Tables created:' as info,
  COUNT(DISTINCT table_name) as table_count
FROM information_schema.tables
WHERE table_name IN ('tasks', 'task_updates', 'task_ec_approvals', 'task_assignments');

SELECT 
  'Active events (should only be approved):' as info,
  COUNT(*) as count
FROM events
WHERE status = 'active';
