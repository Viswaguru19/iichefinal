-- Guest join requests for general meetings with require_approval.
-- Guests get a stable guest_id (e.g. guest-...) so organizers can approve by that id + display name.

CREATE TABLE IF NOT EXISTS meeting_guest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_guest_requests_meeting_status
  ON meeting_guest_requests (meeting_id, status);

ALTER TABLE meeting_guest_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submit guest join request"
  ON meeting_guest_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_id
        AND m.access_type = 'general'
        AND COALESCE(m.require_approval, false) = true
    )
  );

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
              )
          )
        )
    )
  );

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
              )
          )
        )
    )
  );

-- Guests (anon) poll status by meeting + guest_id without exposing other rows.
CREATE OR REPLACE FUNCTION public.get_meeting_guest_request_status(p_meeting_id uuid, p_guest_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mgr.status
  FROM meeting_guest_requests mgr
  WHERE mgr.meeting_id = p_meeting_id AND mgr.guest_id = p_guest_id
  ORDER BY mgr.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_meeting_guest_request_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meeting_guest_request_status(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_meeting_guest_request_status(uuid, text) TO authenticated;
