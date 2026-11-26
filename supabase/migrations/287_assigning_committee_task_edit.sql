-- Assigning committee can see, edit, and delete its tasks.
-- Tasks still waiting on EC approval are hidden from every other committee.

DROP POLICY IF EXISTS "Anyone can view task_assignments" ON task_assignments;
DROP POLICY IF EXISTS "Everyone can view task assignments" ON task_assignments;
DROP POLICY IF EXISTS "View event tasks for stakeholders" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_policy" ON task_assignments;

CREATE POLICY "View event tasks for stakeholders"
  ON task_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.executive_role IS NOT NULL
          OR profiles.is_admin = TRUE
          OR profiles.is_faculty = TRUE
        )
    )
    OR (
      COALESCE(task_assignments.status, '') <> 'pending_ec_approval'
      AND (
        EXISTS (
          SELECT 1 FROM committee_members
          WHERE committee_members.user_id = auth.uid()
            AND committee_members.committee_id = task_assignments.assigned_to_committee
        )
        OR EXISTS (
          SELECT 1 FROM events e
          JOIN committee_members cm ON cm.committee_id = e.committee_id
          WHERE e.id = task_assignments.event_id
            AND cm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM committee_members
          WHERE committee_members.user_id = auth.uid()
            AND committee_members.committee_id = task_assignments.assigned_by_committee
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM committee_members
      WHERE committee_members.user_id = auth.uid()
        AND committee_members.committee_id = task_assignments.assigned_by_committee
    )
  );

DROP POLICY IF EXISTS "Assigning committee can edit tasks" ON task_assignments;
CREATE POLICY "Assigning committee can edit tasks"
  ON task_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM committee_members
      WHERE committee_members.user_id = auth.uid()
        AND committee_members.committee_id = task_assignments.assigned_by_committee
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_admin = TRUE
          OR profiles.is_faculty = TRUE
          OR profiles.executive_role IS NOT NULL
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM committee_members
      WHERE committee_members.user_id = auth.uid()
        AND committee_members.committee_id = task_assignments.assigned_by_committee
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_admin = TRUE
          OR profiles.is_faculty = TRUE
          OR profiles.executive_role IS NOT NULL
        )
    )
  );

DROP POLICY IF EXISTS "Assigning committee can delete tasks" ON task_assignments;
CREATE POLICY "Assigning committee can delete tasks"
  ON task_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM committee_members
      WHERE committee_members.user_id = auth.uid()
        AND committee_members.committee_id = task_assignments.assigned_by_committee
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = TRUE OR profiles.is_faculty = TRUE)
    )
  );
