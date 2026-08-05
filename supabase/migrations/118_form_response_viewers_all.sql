-- Allow all authenticated portal members to view responses when
-- forms.settings.response_viewers_all is true.

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

  -- Explicit: all portal members may view
  IF COALESCE((v_settings->>'response_viewers_all')::boolean, (v_settings->>'responseViewersAll')::boolean, false) THEN
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
