-- Create task_assignments table for the task management workflow
-- This table is used by the Tasks page, Event Detail page, and Event Progress page

CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_committee UUID REFERENCES committees(id),
  assigned_by_committee UUID REFERENCES committees(id),
  assigned_by_user UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_ec_approval',
  ec_approved_by UUID REFERENCES profiles(id),
  ec_approved_at TIMESTAMPTZ,
  ec_rejection_reason TEXT,
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_event ON task_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to_committee);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status ON task_assignments(status);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view task_assignments"
  ON task_assignments FOR SELECT USING (true);

-- Committee heads, EC, admins, and faculty can create task assignments
CREATE POLICY "Heads and EC can create task_assignments"
  ON task_assignments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (executive_role IS NOT NULL OR is_admin = true OR is_faculty = true))
    OR EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
  );

CREATE POLICY "EC and committee can update task_assignments"
  ON task_assignments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (executive_role IS NOT NULL OR is_admin = true OR is_faculty = true))
    OR EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND committee_id = task_assignments.assigned_to_committee)
  );

-- Create task_documents table for file attachments on tasks
CREATE TABLE IF NOT EXISTS task_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES task_assignments(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_documents_task ON task_documents(task_id);

ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view task_documents"
  ON task_documents FOR SELECT USING (true);

CREATE POLICY "Committee members can upload task_documents"
  ON task_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
      WHERE ta.id = task_id AND cm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (executive_role IS NOT NULL OR is_admin = true OR is_faculty = true))
  );

-- Add missing columns to task_updates for progress tracking
ALTER TABLE task_updates ADD COLUMN IF NOT EXISTS progress_before INTEGER;
ALTER TABLE task_updates ADD COLUMN IF NOT EXISTS progress_after INTEGER;

-- Drop FK constraint on task_updates.task_id so it can accept task_assignments IDs too
ALTER TABLE task_updates DROP CONSTRAINT IF EXISTS task_updates_task_id_fkey;

-- Ensure task_updates has user_id column (migration 020 used updated_by, migration 023 used user_id)
ALTER TABLE task_updates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id);
