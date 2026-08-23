-- Fix event registration → event_participants for guests (anon).
-- Also run 084_on_site_registration_source.sql afterward (replaces this RPC signature + registration_source column).
-- Anon can INSERT form_responses but RLS blocks SELECT, so insert().select('id') returns nothing
-- and the client could not set form_response_id for event_participants (policy requires it).
-- This function inserts the response + participant in one transaction as SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.submit_event_registration_response(
  p_form_id uuid,
  p_responses jsonb,
  p_participant_name text,
  p_participant_email text,
  p_via_qr boolean DEFAULT false
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
BEGIN
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
    attended_at
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
    CASE WHEN p_via_qr THEN 'present' ELSE 'registered' END,
    CASE WHEN p_via_qr THEN v_now ELSE NULL END
  );

  RETURN json_build_object(
    'response_id', v_resp_id,
    'participant_id', v_part_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_response(uuid, jsonb, text, text, boolean) TO service_role;

COMMENT ON FUNCTION public.submit_event_registration_response IS
  'Atomically inserts form_responses + event_participants for event registration (works for anon without SELECT on form_responses).';
