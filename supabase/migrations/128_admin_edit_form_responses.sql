-- Super admin can edit submitted form responses (form open or closed).
-- amended_responses: individual view override when "No change result" is chosen.
-- Charts / summaries keep using responses unless "Change result" updates them.

ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS amended_responses jsonb,
  ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_edit_keeps_result boolean;

COMMENT ON COLUMN public.form_responses.amended_responses IS
  'Optional admin override shown on individual view; charts still use responses when admin_edit_keeps_result is true.';

CREATE OR REPLACE FUNCTION public.is_super_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_edit_form_response(
  p_response_id uuid,
  p_responses jsonb,
  p_change_result boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row form_responses%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin_user() THEN
    RAISE EXCEPTION 'Only super admin can edit form responses';
  END IF;

  IF p_responses IS NULL OR jsonb_typeof(p_responses) <> 'object' THEN
    RAISE EXCEPTION 'Invalid responses payload';
  END IF;

  SELECT * INTO v_row FROM form_responses WHERE id = p_response_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;

  IF COALESCE(p_change_result, false) THEN
    UPDATE form_responses
    SET
      responses = p_responses,
      amended_responses = NULL,
      admin_edit_keeps_result = false,
      admin_edited_at = now(),
      admin_edited_by = v_uid
    WHERE id = p_response_id;
  ELSE
    UPDATE form_responses
    SET
      amended_responses = p_responses,
      admin_edit_keeps_result = true,
      admin_edited_at = now(),
      admin_edited_by = v_uid
    WHERE id = p_response_id;
  END IF;

  RETURN json_build_object(
    'response_id', p_response_id,
    'change_result', COALESCE(p_change_result, false)
  );
END;
$$;

DROP POLICY IF EXISTS "form_responses_update_super_admin" ON form_responses;
CREATE POLICY "form_responses_update_super_admin"
  ON form_responses FOR UPDATE
  USING (public.is_super_admin_user())
  WITH CHECK (public.is_super_admin_user());

REVOKE ALL ON FUNCTION public.is_super_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin_user() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_edit_form_response(uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_edit_form_response(uuid, jsonb, boolean) TO authenticated;
