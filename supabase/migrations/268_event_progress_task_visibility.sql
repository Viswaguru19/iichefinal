-- Event Progress: proposing committee, faculty, EC, and admins can see
-- every committee's task updates and documents for an event.

DROP POLICY IF EXISTS "Committee members can view task updates" ON task_updates;
DROP POLICY IF EXISTS "View task updates for event stakeholders" ON task_updates;

CREATE POLICY "View task updates for event stakeholders"
  ON task_updates FOR SELECT
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
    OR EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
      WHERE ta.id = task_updates.task_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN events e ON e.id = ta.event_id
      JOIN committee_members cm ON cm.committee_id = e.committee_id
      WHERE ta.id = task_updates.task_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "EC and admins can view all tasks" ON task_assignments;
DROP POLICY IF EXISTS "View event tasks for stakeholders" ON task_assignments;

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
    OR EXISTS (
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
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_documents'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Everyone can view task documents" ON task_documents';
    EXECUTE 'DROP POLICY IF EXISTS "View task documents for event stakeholders" ON task_documents';
    EXECUTE $pol$
      CREATE POLICY "View task documents for event stakeholders"
        ON task_documents FOR SELECT
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
          OR EXISTS (
            SELECT 1 FROM task_assignments ta
            JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
            WHERE ta.id = task_documents.task_id
              AND cm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM task_assignments ta
            JOIN events e ON e.id = ta.event_id
            JOIN committee_members cm ON cm.committee_id = e.committee_id
            WHERE ta.id = task_documents.task_id
              AND cm.user_id = auth.uid()
          )
        )
    $pol$;
  END IF;
END $$;
