-- Allow general tasks that are not attached to a specific event.
ALTER TABLE task_assignments
ALTER COLUMN event_id DROP NOT NULL;
