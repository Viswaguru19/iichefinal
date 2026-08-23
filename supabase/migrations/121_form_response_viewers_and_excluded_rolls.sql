-- Restrict form_responses SELECT: admin, faculty, form creator, own response,
-- or users listed in forms.settings.response_viewer_ids (not all portal members).

CREATE OR REPLACE FUNCTION public.can_view_form_response_row(p_form_id uuid, p_response_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_created_by uuid;
  v_settings jsonb;
  v_viewers jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Own submission (so "already submitted" checks still work)
  IF p_response_user_id IS NOT NULL AND p_response_user_id = v_uid THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = v_uid AND (COALESCE(p.is_admin, false) OR COALESCE(p.is_faculty, false))
  ) THEN
    RETURN true;
  END IF;

  SELECT f.created_by, COALESCE(f.settings, '{}'::jsonb)
  INTO v_created_by, v_settings
  FROM forms f
  WHERE f.id = p_form_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_created_by IS NOT NULL AND v_created_by = v_uid THEN
    RETURN true;
  END IF;

  v_viewers := COALESCE(v_settings->'response_viewer_ids', v_settings->'responseViewerIds', '[]'::jsonb);
  IF jsonb_typeof(v_viewers) = 'array' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_viewers) AS vid
    WHERE vid = v_uid::text
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "form_responses_select" ON form_responses;
DROP POLICY IF EXISTS "Form responses viewable by authorized users" ON form_responses;
DROP POLICY IF EXISTS "Form creator can view responses" ON form_responses;
DROP POLICY IF EXISTS "form_responses_select_restricted" ON form_responses;

CREATE POLICY "form_responses_select_restricted"
  ON form_responses FOR SELECT
  USING (
    public.can_view_form_response_row(form_id, user_id)
  );

REVOKE ALL ON FUNCTION public.can_view_form_response_row(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_form_response_row(uuid, uuid) TO authenticated;

-- Reject submitting a discontinued (excluded) roll number
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

    IF public.form_roll_already_submitted(p_form_id, v_label, v_roll) THEN
      RAISE EXCEPTION 'Roll number % is already taken for "%"', v_roll, v_label;
    END IF;
  END LOOP;
END;
$$;
