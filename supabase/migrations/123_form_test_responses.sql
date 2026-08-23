-- Test responses: allowed while form is draft / not collecting.
-- Live answers ignore test rows for dedupe. Starting collection clears tests.

ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS form_responses_form_id_is_test_idx
  ON public.form_responses (form_id, is_test);

COMMENT ON COLUMN public.form_responses.is_test IS
  'True when submitted while form was draft / not collecting. Cleared when Start Collecting.';

CREATE OR REPLACE FUNCTION public.form_is_test_mode(p_form forms)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT COALESCE(p_form.is_active, false)
      OR COALESCE(p_form.settings->>'status', '') = 'draft';
$$;

CREATE OR REPLACE FUNCTION public.clear_form_test_responses(p_form_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM form_responses
  WHERE form_id = p_form_id AND is_test = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_form_test_responses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_form_test_responses(uuid) TO authenticated;

-- Live email dedupe: ignore test responses
CREATE OR REPLACE FUNCTION public.form_email_already_submitted(p_form_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_norm text := lower(trim(COALESCE(p_email, '')));
BEGIN
  IF v_norm = '' OR v_norm !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM form_responses fr
    WHERE fr.form_id = p_form_id
      AND COALESCE(fr.is_test, false) = false
      AND EXISTS (
        SELECT 1
        FROM jsonb_each_text(fr.responses) kv
        WHERE (
          lower(kv.key) ~ '(^|[^a-z])(e-?mail|email)'
          OR lower(replace(kv.key, ' ', '')) = 'email'
          OR lower(kv.key) = 'email'
        )
          AND lower(trim(kv.value)) = v_norm
      )
  );
END;
$$;

-- Live mobile dedupe: ignore test responses
CREATE OR REPLACE FUNCTION public.form_mobile_already_submitted(p_form_id uuid, p_mobile text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g');
  v_key text;
BEGIN
  IF length(v_digits) < 7 THEN
    RETURN false;
  END IF;
  v_key := CASE WHEN length(v_digits) > 10 THEN right(v_digits, 10) ELSE v_digits END;

  RETURN EXISTS (
    SELECT 1
    FROM form_responses fr
    WHERE fr.form_id = p_form_id
      AND COALESCE(fr.is_test, false) = false
      AND EXISTS (
        SELECT 1
        FROM jsonb_each_text(fr.responses) kv
        WHERE (
          lower(kv.key) ~ '(mobile|phone|whatsapp|contact)'
          OR lower(replace(kv.key, ' ', '')) IN ('mobile', 'phonenumber', 'mobilenumber', 'contactnumber')
        )
          AND (
            CASE
              WHEN length(regexp_replace(kv.value, '\D', '', 'g')) > 10
                THEN right(regexp_replace(kv.value, '\D', '', 'g'), 10)
              ELSE regexp_replace(kv.value, '\D', '', 'g')
            END
          ) = v_key
      )
  );
END;
$$;

-- Taken rolls: p_is_test = true → only test rows; false → only live rows
CREATE OR REPLACE FUNCTION public.form_taken_roll_numbers(
  p_form_id uuid,
  p_field_label text,
  p_is_test boolean DEFAULT false
)
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
    AND COALESCE(fr.is_test, false) = COALESCE(p_is_test, false)
    AND kv.key = v_label
    AND trim(both FROM kv.value) <> ''
    AND trim(both FROM kv.value) ~ '^\d{1,2}$';

  RETURN COALESCE(v_rolls, ARRAY[]::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.form_roll_already_submitted(
  p_form_id uuid,
  p_field_label text,
  p_roll text,
  p_is_test boolean DEFAULT false
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
      AND COALESCE(fr.is_test, false) = COALESCE(p_is_test, false)
      AND kv.key = v_label
      AND trim(both FROM kv.value) = v_roll
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.form_assert_unique_roll_numbers(
  p_form_id uuid,
  p_responses jsonb,
  p_fields jsonb,
  p_is_test boolean DEFAULT false
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
  v_excluded jsonb;
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

    v_excluded := COALESCE(v_field->'validation'->'excludedRolls', '[]'::jsonb);
    IF jsonb_typeof(v_excluded) = 'array' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_excluded) e WHERE e = v_roll
    ) THEN
      RAISE EXCEPTION 'Roll number % is discontinued for "%"', v_roll, v_label;
    END IF;

    IF public.form_roll_already_submitted(p_form_id, v_label, v_roll, p_is_test) THEN
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
  v_is_test boolean;
BEGIN
  SELECT * INTO v_form FROM forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form not found';
  END IF;

  v_is_test := public.form_is_test_mode(v_form);

  -- Live forms only: reject inactive/draft was old behavior; draft now = test mode
  IF NOT v_is_test AND (NOT v_form.is_active OR COALESCE(v_form.settings->>'status', '') = 'draft') THEN
    RAISE EXCEPTION 'This form is not accepting responses';
  END IF;

  -- Completely missing form (neither collecting nor draft testing shouldn't happen)
  -- Date windows still apply for LIVE only
  IF NOT v_is_test THEN
    IF COALESCE(v_form.settings->>'end_date', '') <> ''
       AND (v_form.settings->>'end_date')::timestamptz < now() THEN
      RAISE EXCEPTION 'This form has passed its deadline';
    END IF;
    IF COALESCE(v_form.settings->>'start_date', '') <> ''
       AND (v_form.settings->>'start_date')::timestamptz > now() THEN
      RAISE EXCEPTION 'This form is not open yet';
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

  -- Event registration live flow uses a different RPC; tests use this path
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

  -- Live-only dedupe (test responses never block a later live submit)
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

REVOKE ALL ON FUNCTION public.form_taken_roll_numbers(uuid, text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.form_taken_roll_numbers(uuid, text);
REVOKE ALL ON FUNCTION public.form_taken_roll_numbers(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_taken_roll_numbers(uuid, text, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.form_roll_already_submitted(uuid, text, text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.form_roll_already_submitted(uuid, text, text);
REVOKE ALL ON FUNCTION public.form_roll_already_submitted(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_roll_already_submitted(uuid, text, text, boolean) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.form_assert_unique_roll_numbers(uuid, jsonb, jsonb);

REVOKE ALL ON FUNCTION public.submit_public_form_response(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_form_response(uuid, jsonb) TO anon, authenticated;
