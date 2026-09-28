-- Keep event participant form_data in sync when later pages are merged into the same response.

CREATE OR REPLACE FUNCTION public.submit_public_form_page_response(
  p_form_id uuid,
  p_responses jsonb,
  p_continue_response_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row form_responses%ROWTYPE;
  v_merged jsonb;
  v_pages jsonb;
BEGIN
  IF p_continue_response_id IS NULL THEN
    RETURN public.submit_public_form_response(p_form_id, p_responses);
  END IF;

  SELECT * INTO v_row
  FROM form_responses
  WHERE id = p_continue_response_id
    AND form_id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Continue link is invalid. Open the form from the start.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x.page_id)), '[]'::jsonb) INTO v_pages
  FROM (
    SELECT DISTINCT trim(page_id) AS page_id
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(v_row.responses->'_pages', '[]'::jsonb)) AS page_id
      UNION ALL
      SELECT jsonb_array_elements_text(COALESCE(p_responses->'_pages', '[]'::jsonb)) AS page_id
    ) raw
    WHERE trim(page_id) <> ''
  ) x;

  v_merged := (COALESCE(v_row.responses, '{}'::jsonb) || COALESCE(p_responses, '{}'::jsonb))
    || jsonb_build_object('_pages', v_pages);

  UPDATE form_responses
  SET responses = v_merged
  WHERE id = v_row.id;

  UPDATE event_participants
  SET form_data = v_merged
  WHERE form_response_id = v_row.id;

  RETURN json_build_object(
    'response_id', v_row.id,
    'is_test', COALESCE(v_row.is_test, false)
  );
END;
$$;
