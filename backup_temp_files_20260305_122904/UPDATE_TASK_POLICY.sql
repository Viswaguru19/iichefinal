-- ============================================
-- UPDATE TASK CREATION POLICY
-- ============================================
-- Allow committee members to create tasks
-- ============================================

-- Drop the old policy
DROP POLICY IF EXISTS "Committee members can create tasks" ON task_assignments;
DROP POLICY IF EXISTS "EC can create tasks" ON task_assignments;

-- Create new policy allowing committee members to create tasks
CREATE POLICY "Committee members can create tasks"
  ON task_assignments FOR INSERT
  WITH CHECK (
    assigned_by_user = auth.uid()
    AND EXISTS (
      SELECT 1 FROM committee_members 
      WHERE committee_members.user_id = auth.uid() 
      AND committee_members.committee_id = task_assignments.assigned_by_committee
    )
  );

SELECT 'Policy updated!' as status,
       'Committee members can now create tasks' as message;
