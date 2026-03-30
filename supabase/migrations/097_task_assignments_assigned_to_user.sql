-- Allow assigning a task to a specific individual (e.g., single EC member or co-head)
ALTER TABLE task_assignments
ADD COLUMN IF NOT EXISTS assigned_to_user UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to_user
ON task_assignments(assigned_to_user);
