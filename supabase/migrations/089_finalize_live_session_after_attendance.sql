-- Migration: 089_finalize_live_session_after_attendance
-- Require meeting attendance to be submitted before saving portal session length,
-- unless no attendance rows exist for the meeting.

CREATE OR REPLACE FUNCTION public.finalize_meeting_live_session(p_meeting_id uuid, p_elapsed_seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_elapsed_seconds < 0 OR p_elapsed_seconds > 604800 THEN
    RAISE EXCEPTION 'invalid elapsed seconds';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM meetings m
    WHERE m.id = p_meeting_id
      AND (
        m.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM profiles pr
          WHERE pr.id = auth.uid()
            AND (
              pr.executive_role IS NOT NULL
              OR pr.is_faculty = true
              OR pr.is_admin = true
              OR pr.role IN ('secretary', 'super_admin')
            )
        )
      )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM meeting_attendance WHERE meeting_id = p_meeting_id LIMIT 1) THEN
    IF EXISTS (
      SELECT 1
      FROM meeting_attendance
      WHERE meeting_id = p_meeting_id
        AND COALESCE(submitted, false) = false
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'attendance_not_finalized';
    END IF;
  END IF;

  UPDATE meetings
  SET
    live_session_elapsed_seconds = p_elapsed_seconds,
    live_session_finalized_at = now()
  WHERE id = p_meeting_id;
END;
$$;
