-- Slot answers on a limited-choice question become the participant group,
-- so attendance can be taken separately for each slot.
-- Event registration also rejects a second live response from the same email
-- unless the form allows multiple submissions.

CREATE OR REPLACE FUNCTION public.form_limited_choice_slot(p_fields jsonb, p_responses jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_field jsonb;
    v_raw text;
    v_label text;
    v_choice text;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'array' OR p_responses IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields)
  LOOP
    IF COALESCE(v_field->>'field_type', '') <> 'limited_choice' THEN
      CONTINUE;
    END IF;
    v_raw := COALESCE(v_field->>'label', '');
    v_label := trim(v_raw);
    IF v_label = '' THEN
      CONTINUE;
    END IF;
    v_choice := trim(COALESCE(NULLIF(p_responses->>v_raw, ''), NULLIF(p_responses->>v_label, ''), ''));
    IF v_choice <> '' THEN
      RETURN v_choice;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_event_participant_group(p_event_id uuid, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(trim(COALESCE(p_name, '')), '');
BEGIN
  IF p_event_id IS NULL OR v_name IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO event_participant_groups (event_id, name, sort_order)
  SELECT p_event_id, v_name, COALESCE((
    SELECT max(sort_order) + 1 FROM event_participant_groups WHERE event_id = p_event_id
  ), 0)
  WHERE NOT EXISTS (
    SELECT 1 FROM event_participant_groups g
    WHERE g.event_id = p_event_id AND lower(g.name) = lower(v_name)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_event_registration_response(
  p_form_id uuid,
  p_responses jsonb,
  p_participant_name text,
  p_participant_email text,
  p_registration_source text DEFAULT 'advance'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_form RECORD;
  v_event_status text;
  v_resp_id uuid;
  v_part_id uuid;
  v_req_login boolean;
  v_access text;
  v_name text;
  v_email text;
  v_email_check text;
  v_now timestamptz := now();
  v_qr json;
  v_src text;
  v_on_site boolean;
  v_allow_multiple boolean;
  v_slot text;
BEGIN
  v_src := COALESCE(NULLIF(trim(p_registration_source), ''), 'advance');
  IF v_src NOT IN ('advance', 'on_site') THEN
    v_src := 'advance';
  END IF;
  v_on_site := (v_src = 'on_site');

  SELECT * INTO v_form FROM forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form not found';
  END IF;

  IF NOT v_form.is_active THEN
    RAISE EXCEPTION 'This form is not accepting responses';
  END IF;

  IF v_form.form_type IS DISTINCT FROM 'event_registration' OR v_form.event_id IS NULL THEN
    RAISE EXCEPTION 'Not an event registration form';
  END IF;

  IF COALESCE(v_form.settings->>'status', '') = 'draft' THEN
    RAISE EXCEPTION 'This form is not accepting responses';
  END IF;

  v_req_login := COALESCE((v_form.settings->>'require_login')::boolean, (v_form.settings->>'requireLogin')::boolean, false);
  v_access := COALESCE(NULLIF(TRIM(v_form.settings->>'access_type'), ''), NULLIF(TRIM(v_form.settings->>'accessType'), ''), 'public');

  IF v_user_id IS NULL AND v_req_login THEN
    RAISE EXCEPTION 'You must be logged in to submit this form';
  END IF;

  IF v_user_id IS NULL AND v_access = 'internal' THEN
    RAISE EXCEPTION 'This form is only available to portal members';
  END IF;

  SELECT e.status INTO v_event_status FROM events e WHERE e.id = v_form.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked event not found';
  END IF;

  IF v_event_status IS NULL
     OR v_event_status NOT IN ('active', 'in_progress', 'faculty_approved') THEN
    RAISE EXCEPTION 'Registration is not open for this event';
  END IF;

  v_allow_multiple := COALESCE((v_form.settings->>'allow_multiple')::boolean, (v_form.settings->>'allowMultiple')::boolean, false);
  v_email := NULLIF(TRIM(COALESCE(p_participant_email, '')), '');
  v_email_check := lower(COALESCE(v_email, ''));
  IF v_email_check = '' THEN
    SELECT lower(trim(kv.value)) INTO v_email_check
    FROM jsonb_each_text(COALESCE(p_responses, '{}'::jsonb)) kv
    WHERE lower(kv.key) ~ '(e-?mail|email)'
    LIMIT 1;
  END IF;

  IF NOT v_allow_multiple
     AND COALESCE(v_email_check, '') <> ''
     AND public.form_email_already_submitted(p_form_id, v_email_check) THEN
    RAISE EXCEPTION 'This email has already submitted this form';
  END IF;

  PERFORM public.form_assert_unique_roll_numbers(p_form_id, p_responses, v_form.fields);

  INSERT INTO form_responses (form_id, user_id, responses)
  VALUES (p_form_id, v_user_id, p_responses)
  RETURNING id INTO v_resp_id;

  v_name := COALESCE(NULLIF(TRIM(p_participant_name), ''), 'Participant');
  v_slot := public.form_limited_choice_slot(v_form.fields, p_responses);
  IF v_slot IS NOT NULL THEN
    PERFORM public.ensure_event_participant_group(v_form.event_id, v_slot);
  END IF;

  v_part_id := gen_random_uuid();

  v_qr := json_build_object(
    'participant_id', v_part_id::text,
    'event_id', v_form.event_id::text,
    'response_id', v_resp_id::text,
    'form_id', p_form_id::text,
    'participant_name', v_name,
    'participant_email', COALESCE(v_email, ''),
    'slot', COALESCE(v_slot, ''),
    'submitted_at', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  INSERT INTO event_participants (
    id,
    event_id,
    form_response_id,
    user_id,
    participant_name,
    participant_email,
    participant_group,
    form_data,
    qr_data,
    attendance_status,
    attended_at,
    registration_source
  )
  VALUES (
    v_part_id,
    v_form.event_id,
    v_resp_id,
    v_user_id,
    v_name,
    v_email,
    v_slot,
    p_responses,
    v_qr::text,
    CASE WHEN v_on_site THEN 'present' ELSE 'registered' END,
    CASE WHEN v_on_site THEN v_now ELSE NULL END,
    v_src
  );

  RETURN json_build_object(
    'response_id', v_resp_id,
    'participant_id', v_part_id,
    'slot', v_slot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, text) TO anon, authenticated, service_role;

-- Existing form registrants: move them into the slot they chose.
UPDATE event_participants ep
SET participant_group = slot.choice
FROM form_responses fr
JOIN forms f ON f.id = fr.form_id
CROSS JOIN LATERAL (
  SELECT public.form_limited_choice_slot(f.fields, fr.responses) AS choice
) slot
WHERE ep.form_response_id = fr.id
  AND slot.choice IS NOT NULL
  AND (
    ep.participant_group IS NULL
    OR btrim(ep.participant_group) = ''
    OR ep.participant_group IN ('Registered through form', 'Form registration')
  );

INSERT INTO event_participant_groups (event_id, name, sort_order)
SELECT DISTINCT ep.event_id, btrim(ep.participant_group), 0
FROM event_participants ep
WHERE btrim(COALESCE(ep.participant_group, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM event_participant_groups g
    WHERE g.event_id = ep.event_id AND lower(g.name) = lower(btrim(ep.participant_group))
  );
