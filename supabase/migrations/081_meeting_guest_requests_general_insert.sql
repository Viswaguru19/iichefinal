-- Allow guest join requests for any general (public link) meeting.
-- Previously INSERT required require_approval = true, so guests could bypass the queue when that flag was off.

DROP POLICY IF EXISTS "Submit guest join request" ON meeting_guest_requests;

CREATE POLICY "Submit guest join request"
  ON meeting_guest_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_id
        AND m.access_type = 'general'
    )
  );

-- Let super_admin / secretary see and resolve guest requests (matches in-app Approvals panel).
DROP POLICY IF EXISTS "Managers can view guest requests" ON meeting_guest_requests;
CREATE POLICY "Managers can view guest requests"
  ON meeting_guest_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings mt
      WHERE mt.id = meeting_guest_requests.meeting_id
        AND (
          mt.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND (
                p.executive_role IS NOT NULL
                OR p.is_faculty = true
                OR p.is_admin = true
                OR p.role IN ('super_admin', 'secretary')
              )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Managers can update guest requests" ON meeting_guest_requests;
CREATE POLICY "Managers can update guest requests"
  ON meeting_guest_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings mt
      WHERE mt.id = meeting_guest_requests.meeting_id
        AND (
          mt.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND (
                p.executive_role IS NOT NULL
                OR p.is_faculty = true
                OR p.is_admin = true
                OR p.role IN ('super_admin', 'secretary')
              )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings mt
      WHERE mt.id = meeting_guest_requests.meeting_id
        AND (
          mt.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND (
                p.executive_role IS NOT NULL
                OR p.is_faculty = true
                OR p.is_admin = true
                OR p.role IN ('super_admin', 'secretary')
              )
          )
        )
    )
  );
