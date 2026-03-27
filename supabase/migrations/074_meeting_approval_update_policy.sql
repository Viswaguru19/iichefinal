-- Migration: 074_meeting_approval_update_policy
-- Allow organizer/EC/faculty/admin to approve or reject meeting join requests.

DROP POLICY IF EXISTS "Managers and creators can update participants" ON meeting_participants;
CREATE POLICY "Managers and creators can update participants"
  ON meeting_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
        AND (
          meetings.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                profiles.executive_role IS NOT NULL
                OR profiles.is_faculty = true
                OR profiles.is_admin = true
              )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
        AND (
          meetings.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                profiles.executive_role IS NOT NULL
                OR profiles.is_faculty = true
                OR profiles.is_admin = true
              )
          )
        )
    )
  );
