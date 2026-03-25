-- ============================================
-- Fix reminders table for the new reminder workflow
-- The existing FK references event_proposals, but we now
-- store event IDs and task_assignment IDs in proposal_id.
-- Drop the FK constraint so it becomes a plain UUID column.
-- ============================================

-- Drop the foreign key constraint on proposal_id
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_proposal_id_fkey;

-- Add an index for faster cooldown lookups (sent_by + proposal_id)
CREATE INDEX IF NOT EXISTS idx_reminders_sent_by_proposal
  ON reminders(sent_by, proposal_id, created_at DESC);

-- Add an index for fetching reminder logs by entity
CREATE INDEX IF NOT EXISTS idx_reminders_proposal_id
  ON reminders(proposal_id, created_at DESC);
