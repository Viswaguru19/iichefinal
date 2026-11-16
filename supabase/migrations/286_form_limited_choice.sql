-- Limited-choice questions: each option has a max number of live answers.
-- Counts are enforced in a trigger so public, event-registration, and continue-merge submits all respect caps.

CREATE OR REPLACE FUNCTION public.form_limited_choice_counts(
  p_form_id uuid,
  p_field_label text,
  p_is_test boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_label text := trim(COALESCE(p_field_label, ''));
  v_out jsonb;
BEGIN
  IF v_label = '' THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_object_agg(choice, n), '{}'::jsonb)
  INTO v_out
  FROM (
    SELECT trim(both FROM kv.value) AS choice, count(*)::int AS n
    FROM form_responses fr
    CROSS JOIN LATERAL jsonb_each_text(fr.responses) kv
    WHERE fr.form_id = p_form_id
      AND COALESCE(fr.is_test, false) = COALESCE(p_is_test, false)
      AND kv.key = v_label
      AND trim(both FROM kv.value) <> ''
    GROUP BY 1
  ) s;

  RETURN COALESCE(v_out, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.form_assert_limited_choice_capacity(
  p_form_id uuid,
  p_responses jsonb,
  p_fields jsonb,
  p_is_test boolean DEFAULT false,
  p_exclude_response_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field jsonb;
  v_label text;
  v_choice text;
  v_idx int;
  v_max int;
  v_max_text text;
  v_count int;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'array' THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(('x' || substr(md5(p_form_id::text), 1, 16))::bit(64)::bigint);

  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields)
  LOOP
    IF COALESCE(v_field->>'field_type', '') <> 'limited_choice' THEN
      CONTINUE;
    END IF;

    v_label := trim(COALESCE(v_field->>'label', ''));
    IF v_label = '' THEN
      CONTINUE;
    END IF;

    v_choice := trim(COALESCE(p_responses->>v_label, ''));
    IF v_choice = '' THEN
      CONTINUE;
    END IF;

    v_idx := NULL;
    SELECT (t.ord - 1)::int
    INTO v_idx
    FROM jsonb_array_elements_text(COALESCE(v_field->'options', '[]'::jsonb)) WITH ORDINALITY AS t(val, ord)
    WHERE trim(t.val) = v_choice
    LIMIT 1;

    IF v_idx IS NULL THEN
      RAISE EXCEPTION 'Invalid option for "%"', v_label;
    END IF;

    v_max_text := v_field#>>ARRAY['validation', 'optionMax', v_idx::text];
    IF v_max_text IS NULL OR btrim(v_max_text) = '' THEN
      v_max := 100;
    ELSE
      BEGIN
        v_max := v_max_text::int;
      EXCEPTION WHEN others THEN
        v_max := 100;
      END;
    END IF;

    IF v_max < 1 THEN
      CONTINUE;
    END IF;

    SELECT count(*)::int
    INTO v_count
    FROM form_responses fr
    WHERE fr.form_id = p_form_id
      AND COALESCE(fr.is_test, false) = COALESCE(p_is_test, false)
      AND (p_exclude_response_id IS NULL OR fr.id <> p_exclude_response_id)
      AND trim(COALESCE(fr.responses->>v_label, '')) = v_choice;

    IF v_count >= v_max THEN
      RAISE EXCEPTION '"%" is full (% / %). Choose another option.', v_choice, v_max, v_max;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.form_responses_limited_choice_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fields jsonb;
BEGIN
  SELECT fields INTO v_fields FROM forms WHERE id = NEW.form_id;
  PERFORM public.form_assert_limited_choice_capacity(
    NEW.form_id,
    NEW.responses,
    v_fields,
    COALESCE(NEW.is_test, false),
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_responses_limited_choice_guard ON public.form_responses;
CREATE TRIGGER form_responses_limited_choice_guard
  BEFORE INSERT OR UPDATE OF responses ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.form_responses_limited_choice_guard();

REVOKE ALL ON FUNCTION public.form_limited_choice_counts(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_limited_choice_counts(uuid, text, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.form_assert_limited_choice_capacity(uuid, jsonb, jsonb, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_assert_limited_choice_capacity(uuid, jsonb, jsonb, boolean, uuid) TO anon, authenticated;
