-- Duplicate detection: email first, otherwise mobile number.

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

  -- Fallback when no email: block duplicate mobile
  IF NOT v_allow_multiple
     AND (COALESCE(v_email, '') = '')
     AND COALESCE(v_mobile, '') <> ''
     AND public.form_mobile_already_submitted(p_form_id, v_mobile) THEN
    RAISE EXCEPTION 'This mobile number has already submitted this form';
  END IF;

  INSERT INTO form_responses (form_id, user_id, responses)
  VALUES (p_form_id, auth.uid(), p_responses)
  RETURNING id INTO v_id;

  RETURN json_build_object('response_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.form_mobile_already_submitted(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_mobile_already_submitted(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_public_form_response(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_form_response(uuid, jsonb) TO anon, authenticated;
