-- Allow any authenticated portal user to update or delete any form.

ALTER TABLE forms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP POLICY IF EXISTS "forms_update" ON forms;
CREATE POLICY "forms_update"
ON forms FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "forms_delete" ON forms;
CREATE POLICY "forms_delete"
ON forms FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Align backfill RPC with portal-wide form edit access.
CREATE OR REPLACE FUNCTION public.backfill_event_participants_from_form(p_form_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_form RECORD;
  v_event_status text;
  v_resp RECORD;
  v_name text;
  v_email text;
  v_part_id uuid;
  v_now timestamptz := now();
  v_qr json;
  v_inserted int := 0;
  v_skipped int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  SELECT * INTO v_form FROM forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form not found';
  END IF;

  IF v_form.form_type IS DISTINCT FROM 'event_registration' OR v_form.event_id IS NULL THEN
    RAISE EXCEPTION 'Form must be an event registration form linked to an event';
  END IF;

  SELECT e.status INTO v_event_status FROM events e WHERE e.id = v_form.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked event not found';
  END IF;

  IF v_event_status IS NULL
     OR v_event_status NOT IN ('active', 'in_progress', 'faculty_approved', 'completed') THEN
    RAISE EXCEPTION 'Participants cannot be added for this event status';
  END IF;

  FOR v_resp IN
    SELECT fr.id, fr.user_id, fr.responses, fr.submitted_at
    FROM form_responses fr
    WHERE fr.form_id = p_form_id
      AND NOT EXISTS (
        SELECT 1 FROM event_participants ep WHERE ep.form_response_id = fr.id
      )
    ORDER BY fr.submitted_at ASC NULLS LAST, fr.created_at ASC
  LOOP
    v_name := extract_form_response_name(v_form.fields, v_resp.responses);
    v_email := extract_form_response_email(v_form.fields, v_resp.responses);
    v_part_id := gen_random_uuid();

    v_qr := json_build_object(
      'participant_id', v_part_id::text,
      'event_id', v_form.event_id::text,
      'response_id', v_resp.id::text,
      'form_id', p_form_id::text,
      'participant_name', v_name,
      'participant_email', COALESCE(v_email, ''),
      'submitted_at', to_char(COALESCE(v_resp.submitted_at, v_now) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    BEGIN
      INSERT INTO event_participants (
        id,
        event_id,
        form_response_id,
        user_id,
        participant_name,
        participant_email,
        form_data,
        qr_data,
        attendance_status,
        attended_at,
        registration_source
      )
      VALUES (
        v_part_id,
        v_form.event_id,
        v_resp.id,
        v_resp.user_id,
        v_name,
        v_email,
        v_resp.responses,
        v_qr::text,
        'registered',
        NULL,
        'advance'
      );
      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped
  );
END;
$$;
