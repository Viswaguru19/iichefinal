-- Migration: 073_meeting_participants_and_creator_attendance_rls
-- Purpose: Ensure meeting joiners are visible and meeting creators can finalize attendance.

-- meeting_participants policies
ALTER TABLE IF EXISTS meeting_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view meeting participants" ON meeting_participants;
CREATE POLICY "Authenticated users can view meeting participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can add themselves as participants" ON meeting_participants;
CREATE POLICY "Users can add themselves as participants"
  ON meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own participant rows" ON meeting_participants;
CREATE POLICY "Users can update their own participant rows"
  ON meeting_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- meeting creators need read/write attendance even if not EC/faculty/admin
DROP POLICY IF EXISTS "Meeting creators can view attendance" ON meeting_attendance;
CREATE POLICY "Meeting creators can view attendance"
  ON meeting_attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM meetings
      WHERE meetings.id = meeting_attendance.meeting_id
        AND meetings.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Meeting creators can manage attendance" ON meeting_attendance;
CREATE POLICY "Meeting creators can manage attendance"
  ON meeting_attendance FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM meetings
      WHERE meetings.id = meeting_attendance.meeting_id
        AND meetings.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM meetings
      WHERE meetings.id = meeting_attendance.meeting_id
        AND meetings.created_by = auth.uid()
    )
  );
