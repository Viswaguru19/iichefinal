-- Create tasks table for event task management

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES committees(id),
  status TEXT DEFAULT 'pending_ec_approval' CHECK (status IN ('pending_ec_approval', 'assigned', 'in_progress', 'completed', 'cancelled')),
  ec_approved BOOLEAN DEFAULT false,
  ec_approved_at TIMESTAMPTZ,
  ec_approved_by UUID REFERENCES profiles(id),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks"
  ON tasks FOR SELECT
  USING (
    -- Users can see tasks assigned to their committee
    assigned_to IN (
      SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
    )
    OR
    -- EC members can see all tasks
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR
    -- Admins can see all tasks
    is_admin(auth.uid())
    OR
    -- Task creator can see their tasks
    created_by = auth.uid()
  );

-- Allow EC and admins to create tasks
CREATE POLICY "EC can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR is_admin(auth.uid())
  );

-- Allow EC to update tasks (for approval)
CREATE POLICY "EC can update tasks"
  ON tasks FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR is_admin(auth.uid())
    OR
    -- Committee members can update their assigned tasks
    assigned_to IN (
      SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR is_admin(auth.uid())
    OR
    assigned_to IN (
      SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
    )
  );

-- Allow EC and admins to delete tasks
CREATE POLICY "EC can delete tasks"
  ON tasks FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR is_admin(auth.uid())
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
