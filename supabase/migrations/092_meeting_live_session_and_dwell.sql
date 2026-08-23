-- Migration: 088_meeting_live_session_and_dwell
-- Per-user cumulative seconds in portal meetings + optional finalized room session length.

ALTER TABLE meeting_participants
  ADD COLUMN IF NOT EXISTS live_total_seconds INTEGER NOT NULL DEFAULT 0 CHECK (live_total_seconds >= 0);

ALTER TABLE meeting_participants
  ADD COLUMN IF NOT EXISTS live_last_seen_at TIMESTAMPTZ;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS live_session_elapsed_seconds INTEGER CHECK (live_session_elapsed_seconds IS NULL OR live_session_elapsed_seconds >= 0);

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS live_session_finalized_at TIMESTAMPTZ;

COMMENT ON COLUMN meeting_participants.live_total_seconds IS 'Cumulative seconds the member spent in the portal live room for this meeting.';
COMMENT ON COLUMN meetings.live_session_elapsed_seconds IS 'Active room session length (seconds) saved by a moderator from the live room UI.';

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

  UPDATE meetings
  SET
    live_session_elapsed_seconds = p_elapsed_seconds,
    live_session_finalized_at = now()
  WHERE id = p_meeting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_meeting_live_session(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_meeting_live_session(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_meeting_participant_live_seconds(p_meeting_id uuid, p_delta integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE meeting_participants
  SET
    live_total_seconds = live_total_seconds + LEAST(GREATEST(p_delta, 0), 86400),
    live_last_seen_at = now()
  WHERE meeting_id = p_meeting_id
    AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.add_meeting_participant_live_seconds(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_meeting_participant_live_seconds(uuid, integer) TO authenticated;
