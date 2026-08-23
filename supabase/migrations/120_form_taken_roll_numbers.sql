-- Taken roll numbers: hide already-used rolls from the searchable dropdown,
-- and block duplicate roll submission server-side.

CREATE OR REPLACE FUNCTION public.form_taken_roll_numbers(p_form_id uuid, p_field_label text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_label text := trim(COALESCE(p_field_label, ''));
  v_rolls text[];
BEGIN
  IF v_label = '' THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT trim(both FROM kv.value)), ARRAY[]::text[])
  INTO v_rolls
  FROM form_responses fr
  CROSS JOIN LATERAL jsonb_each_text(fr.responses) kv
  WHERE fr.form_id = p_form_id
    AND kv.key = v_label
    AND trim(both FROM kv.value) <> ''
    AND trim(both FROM kv.value) ~ '^\d{1,2}$';

  RETURN COALESCE(v_rolls, ARRAY[]::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.form_roll_already_submitted(
  p_form_id uuid,
  p_field_label text,
  p_roll text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_label text := trim(COALESCE(p_field_label, ''));
  v_roll text := trim(COALESCE(p_roll, ''));
BEGIN
  IF v_label = '' OR v_roll = '' OR v_roll !~ '^\d{1,2}$' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM form_responses fr
    CROSS JOIN LATERAL jsonb_each_text(fr.responses) kv
    WHERE fr.form_id = p_form_id
      AND kv.key = v_label
      AND trim(both FROM kv.value) = v_roll
  );
END;
$$;

-- Raise if any roll_no field value in p_responses was already used on this form.
CREATE OR REPLACE FUNCTION public.form_assert_unique_roll_numbers(
  p_form_id uuid,
  p_responses jsonb,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field jsonb;
  v_label text;
  v_roll text;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields)
  LOOP
    IF COALESCE(v_field->>'field_type', '') <> 'roll_no' THEN
      CONTINUE;
    END IF;
    v_label := trim(COALESCE(v_field->>'label', ''));
    IF v_label = '' THEN
      CONTINUE;
    END IF;
    v_roll := trim(COALESCE(p_responses->>v_label, ''));
    IF v_roll = '' THEN
      CONTINUE;
    END IF;
    IF public.form_roll_already_submitted(p_form_id, v_label, v_roll) THEN
      RAISE EXCEPTION 'Roll number % is already taken for "%"', v_roll, v_label;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_form_response(
  p_form_id uuid,
  p_responses jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form forms%ROWTYPE;
  v_allow_multiple boolean;
  v_email text;
  v_mobile text;
  v_id uuid;
  v_req_login boolean;
  v_access text;
BEGIN
  SELECT * INTO v_form FROM forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form not found';
  END IF;

  IF NOT v_form.is_active OR COALESCE(v_form.settings->>'status', '') = 'draft' THEN
    RAISE EXCEPTION 'This form is not accepting responses';
  END IF;

  v_req_login := COALESCE((v_form.settings->>'require_login')::boolean, (v_form.settings->>'requireLogin')::boolean, false);
  v_access := COALESCE(NULLIF(TRIM(v_form.settings->>'access_type'), ''), NULLIF(TRIM(v_form.settings->>'accessType'), ''), 'public');

  IF auth.uid() IS NULL AND v_req_login THEN
    RAISE EXCEPTION 'You must be logged in to submit this form';
  END IF;

  IF auth.uid() IS NULL AND v_access = 'internal' THEN
    RAISE EXCEPTION 'This form is only available to portal members';
  END IF;

  IF v_form.form_type = 'event_registration' THEN
    RAISE EXCEPTION 'Use submit_event_registration_response for event registration forms';
  END IF;

  v_allow_multiple := COALESCE((v_form.settings->>'allow_multiple')::boolean, (v_form.settings->>'allowMultiple')::boolean, false);

  SELECT lower(trim(kv.value)) INTO v_email
  FROM jsonb_each_text(p_responses) kv
  WHERE lower(kv.key) ~ '(^|[^a-z])(e-?mail|email)'
     OR lower(replace(kv.key, ' ', '')) = 'email'
  LIMIT 1;

  IF v_email IS NULL OR v_email = '' THEN
    v_email := lower(trim(COALESCE(p_responses->>'Email', p_responses->>'email', '')));
  END IF;

  SELECT regexp_replace(kv.value, '\D', '', 'g') INTO v_mobile
  FROM jsonb_each_text(p_responses) kv
  WHERE lower(kv.key) ~ '(mobile|phone|whatsapp|contact)'
  LIMIT 1;

  IF v_mobile IS NULL OR v_mobile = '' THEN
    v_mobile := regexp_replace(
      COALESCE(p_responses->>'Mobile', p_responses->>'mobile', p_responses->>'Phone', p_responses->>'phone', ''),
      '\D', '', 'g'
    );
  END IF;

  IF NOT v_allow_multiple AND auth.uid() IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM form_responses WHERE form_id = p_form_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'You have already submitted this form';
    END IF;
  END IF;

  IF NOT v_allow_multiple AND COALESCE(v_email, '') <> '' AND public.form_email_already_submitted(p_form_id, v_email) THEN
    RAISE EXCEPTION 'This email has already submitted this form';
  END IF;

  IF NOT v_allow_multiple
     AND (COALESCE(v_email, '') = '')
     AND COALESCE(v_mobile, '') <> ''
     AND public.form_mobile_already_submitted(p_form_id, v_mobile) THEN
    RAISE EXCEPTION 'This mobile number has already submitted this form';
  END IF;

  PERFORM public.form_assert_unique_roll_numbers(p_form_id, p_responses, v_form.fields);

  INSERT INTO form_responses (form_id, user_id, responses)
  VALUES (p_form_id, auth.uid(), p_responses)
  RETURNING id INTO v_id;

  RETURN json_build_object('response_id', v_id);
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
  v_now timestamptz := now();
  v_qr json;
  v_src text;
  v_on_site boolean;
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

  PERFORM public.form_assert_unique_roll_numbers(p_form_id, p_responses, v_form.fields);

  INSERT INTO form_responses (form_id, user_id, responses)
  VALUES (p_form_id, v_user_id, p_responses)
  RETURNING id INTO v_resp_id;

  v_name := COALESCE(NULLIF(TRIM(p_participant_name), ''), 'Participant');
  v_email := NULLIF(TRIM(COALESCE(p_participant_email, '')), '');

  v_part_id := gen_random_uuid();

  v_qr := json_build_object(
    'participant_id', v_part_id::text,
    'event_id', v_form.event_id::text,
    'response_id', v_resp_id::text,
    'form_id', p_form_id::text,
    'participant_name', v_name,
    'participant_email', COALESCE(v_email, ''),
    'submitted_at', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

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
    v_resp_id,
    v_user_id,
    v_name,
    v_email,
    p_responses,
    v_qr::text,
    CASE WHEN v_on_site THEN 'present' ELSE 'registered' END,
    CASE WHEN v_on_site THEN v_now ELSE NULL END,
    v_src
  );

  RETURN json_build_object(
    'response_id', v_resp_id,
    'participant_id', v_part_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.form_taken_roll_numbers(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_taken_roll_numbers(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.form_roll_already_submitted(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_roll_already_submitted(uuid, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.form_assert_unique_roll_numbers(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_assert_unique_roll_numbers(uuid, jsonb, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_public_form_response(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_form_response(uuid, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, text) TO anon, authenticated, service_role;
