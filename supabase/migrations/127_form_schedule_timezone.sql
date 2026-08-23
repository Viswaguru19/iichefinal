-- Form schedule windows: datetime-local strings have no timezone.
-- Casting them as UTC made Indian mornings look "not open yet".
-- Interpret bare dates/datetimes as Asia/Kolkata wall time.

CREATE OR REPLACE FUNCTION public.form_settings_ts(p_raw text, p_end_of_day boolean DEFAULT false)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_raw IS NULL OR btrim(p_raw) = '' THEN NULL
    WHEN btrim(p_raw) ~ '^\d{4}-\d{2}-\d{2}$' THEN
      CASE
        WHEN p_end_of_day THEN (btrim(p_raw) || ' 23:59:59.999')::timestamp AT TIME ZONE 'Asia/Kolkata'
        ELSE (btrim(p_raw) || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Kolkata'
      END
    WHEN btrim(p_raw) ~ 'Z|[+-]\d{2}(:?\d{2})?$' THEN
      btrim(p_raw)::timestamptz
    ELSE
      replace(btrim(p_raw), 'T', ' ')::timestamp AT TIME ZONE 'Asia/Kolkata'
  END;
$$;

CREATE OR REPLACE FUNCTION public.form_is_test_mode(p_form forms)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_form.is_active, false) THEN false
    ELSE COALESCE((p_form.settings->>'test_mode')::boolean, false)
      OR COALESCE((p_form.settings->>'testMode')::boolean, false)
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
  v_is_test boolean;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  SELECT * INTO v_form FROM forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form not found';
  END IF;

  v_is_test := public.form_is_test_mode(v_form);

  IF NOT v_is_test AND NOT COALESCE(v_form.is_active, false) THEN
    RAISE EXCEPTION 'This form is not accepting responses';
  END IF;

  IF NOT v_is_test THEN
    v_start := public.form_settings_ts(v_form.settings->>'start_date', false);
    v_end := public.form_settings_ts(v_form.settings->>'end_date', true);
    IF v_start IS NOT NULL AND v_start > now() THEN
      RAISE EXCEPTION 'This form is not open yet';
    END IF;
    IF v_end IS NOT NULL AND v_end < now() THEN
      RAISE EXCEPTION 'This form has passed its deadline';
    END IF;
  END IF;

  v_req_login := COALESCE((v_form.settings->>'require_login')::boolean, (v_form.settings->>'requireLogin')::boolean, false);
  v_access := COALESCE(NULLIF(TRIM(v_form.settings->>'access_type'), ''), NULLIF(TRIM(v_form.settings->>'accessType'), ''), 'public');

  IF auth.uid() IS NULL AND v_req_login THEN
    RAISE EXCEPTION 'You must be logged in to submit this form';
  END IF;

  IF auth.uid() IS NULL AND v_access = 'internal' THEN
    RAISE EXCEPTION 'This form is only available to portal members';
  END IF;

  IF NOT v_is_test AND v_form.form_type = 'event_registration' THEN
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

  IF NOT v_is_test THEN
    IF NOT v_allow_multiple AND auth.uid() IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM form_responses
        WHERE form_id = p_form_id AND user_id = auth.uid() AND COALESCE(is_test, false) = false
      ) THEN
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
  END IF;

  PERFORM public.form_assert_unique_roll_numbers(p_form_id, p_responses, v_form.fields, v_is_test);

  INSERT INTO form_responses (form_id, user_id, responses, is_test)
  VALUES (p_form_id, auth.uid(), p_responses, v_is_test)
  RETURNING id INTO v_id;

  RETURN json_build_object('response_id', v_id, 'is_test', v_is_test);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_form_response(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_form_response(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.form_settings_ts(text, boolean) TO anon, authenticated;
