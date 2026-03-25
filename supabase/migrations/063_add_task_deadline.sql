-- Add deadline column to task_assignments if it doesn't exist
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
