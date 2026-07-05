-- Public forms: anyone can open /forms/[id] and submit without login.
-- Email dedupe via SECURITY DEFINER RPC (anon cannot SELECT form_responses).

-- Read active public forms (all types, not only event_registration)
DROP POLICY IF EXISTS "forms_select_public_open" ON forms;
CREATE POLICY "forms_select_public_open"
ON forms FOR SELECT
USING (
  is_active = true
  AND COALESCE(settings->>'status', 'active') <> 'draft'
  AND COALESCE((settings->>'require_login')::boolean, (settings->>'requireLogin')::boolean, false) = false
  AND COALESCE(NULLIF(TRIM(settings->>'access_type'), ''), NULLIF(TRIM(settings->>'accessType'), ''), 'public') <> 'internal'
);

-- Anonymous insert for public forms (non-event flows; event_registration also covered)
DROP POLICY IF EXISTS "form_responses_insert_anon_public" ON form_responses;
CREATE POLICY "form_responses_insert_anon_public"
ON form_responses FOR INSERT
WITH CHECK (
  auth.uid() IS NULL
  AND user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id::text = form_responses.form_id::text
      AND f.is_active = true
      AND COALESCE(f.settings->>'status', 'active') <> 'draft'
      AND COALESCE((f.settings->>'require_login')::boolean, (f.settings->>'requireLogin')::boolean, false) = false
      AND COALESCE(NULLIF(TRIM(f.settings->>'access_type'), ''), NULLIF(TRIM(f.settings->>'accessType'), ''), 'public') <> 'internal'
  )
);

-- Anon file uploads on public forms (path: form-uploads/...)
DROP POLICY IF EXISTS "anon_upload_form_files" ON storage.objects;
CREATE POLICY "anon_upload_form_files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND name LIKE 'form-uploads/%'
);

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

  IF NOT v_allow_multiple AND auth.uid() IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM form_responses WHERE form_id = p_form_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'You have already submitted this form';
    END IF;
  END IF;

  IF NOT v_allow_multiple AND v_email <> '' AND public.form_email_already_submitted(p_form_id, v_email) THEN
    RAISE EXCEPTION 'This email has already submitted this form';
  END IF;

  INSERT INTO form_responses (form_id, user_id, responses)
  VALUES (p_form_id, auth.uid(), p_responses)
  RETURNING id INTO v_id;

  RETURN json_build_object('response_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.form_email_already_submitted(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_email_already_submitted(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_public_form_response(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_form_response(uuid, jsonb) TO anon, authenticated;
