-- Backfill event_participants from existing form_responses when a normal form is converted to event registration.

CREATE OR REPLACE FUNCTION public.extract_form_response_name(
  p_fields jsonb,
  p_responses jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_label text;
  v_key text;
  v_val text;
BEGIN
  SELECT f->>'label' INTO v_label
  FROM jsonb_array_elements(COALESCE(p_fields, '[]'::jsonb)) AS f
  WHERE (f->>'id' IN ('f_responder_name', 'f_er_name'))
     OR (f->>'field_type' = 'text' AND lower(trim(f->>'label')) = 'name')
  LIMIT 1;

  IF v_label IS NOT NULL THEN
    v_val := NULLIF(trim(COALESCE(p_responses->>v_label, '')), '');
    IF v_val IS NOT NULL THEN
      RETURN v_val;
    END IF;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_responses, '{}'::jsonb))
  LOOP
    v_val := NULLIF(trim(COALESCE(p_responses->>v_key, '')), '');
    IF v_val IS NULL THEN
      CONTINUE;
    END IF;
    IF lower(v_key) ~ 'name'
       AND lower(v_key) !~ 'user\s*name|username|company|team|branch|if\s*name|domain' THEN
      RETURN v_val;
    END IF;
  END LOOP;

  RETURN 'Participant';
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_form_response_email(
  p_fields jsonb,
  p_responses jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_label text;
  v_key text;
  v_val text;
BEGIN
  SELECT f->>'label' INTO v_label
  FROM jsonb_array_elements(COALESCE(p_fields, '[]'::jsonb)) AS f
  WHERE (f->>'id' IN ('f_responder_email', 'f_er_email'))
     OR (f->>'field_type' = 'email')
     OR (lower(regexp_replace(trim(f->>'label'), '\s+', ' ', 'g')) ~ '^e-?mail$')
  LIMIT 1;

  IF v_label IS NOT NULL THEN
    v_val := NULLIF(trim(COALESCE(p_responses->>v_label, '')), '');
    IF v_val IS NOT NULL AND v_val ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      RETURN v_val;
    END IF;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_responses, '{}'::jsonb))
  LOOP
    v_val := NULLIF(trim(COALESCE(p_responses->>v_key, '')), '');
    IF v_val IS NULL OR v_val !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      CONTINUE;
    END IF;
    IF lower(regexp_replace(v_key, '\s+', ' ', 'g')) ~ '(e-?mail|correo)|email' THEN
      RETURN v_val;
    END IF;
  END LOOP;

  FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_responses, '{}'::jsonb))
  LOOP
    v_val := NULLIF(trim(COALESCE(p_responses->>v_key, '')), '');
    IF v_val IS NOT NULL AND v_val ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      RETURN v_val;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

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

  IF NOT (
    v_form.created_by = v_user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = v_user_id
        AND (COALESCE(p.is_admin, false) OR COALESCE(p.is_faculty, false) OR p.executive_role IS NOT NULL)
    )
  ) THEN
    RAISE EXCEPTION 'You do not have permission to convert this form';
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

REVOKE ALL ON FUNCTION public.backfill_event_participants_from_form(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_event_participants_from_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_event_participants_from_form(uuid) TO service_role;

COMMENT ON FUNCTION public.backfill_event_participants_from_form IS
  'Creates event_participants for form_responses not yet linked, after converting a form to event_registration.';
