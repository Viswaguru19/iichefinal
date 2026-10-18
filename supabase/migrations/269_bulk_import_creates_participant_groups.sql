-- Create named participant groups during bulk import (e.g. CHE A) if they do not exist.

CREATE OR REPLACE FUNCTION public.bulk_import_event_participants(
  p_event_id uuid,
  p_rows jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event RECORD;
  v_row jsonb;
  v_name text;
  v_email text;
  v_group text;
  v_part_id uuid;
  v_now timestamptz := now();
  v_qr json;
  v_inserted int := 0;
  v_skipped int := 0;
  v_errors text[] := ARRAY[]::text[];
  v_idx int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT id, status INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.status IS NULL
     OR v_event.status NOT IN ('active', 'in_progress', 'faculty_approved', 'completed') THEN
    RAISE EXCEPTION 'Participants cannot be added for this event status';
  END IF;

  INSERT INTO event_participant_groups (event_id, name)
  SELECT DISTINCT p_event_id, TRIM(COALESCE(value->>'group', value->>'participant_group', ''))
  FROM jsonb_array_elements(p_rows)
  WHERE NULLIF(TRIM(COALESCE(value->>'group', value->>'participant_group', '')), '') IS NOT NULL
  ON CONFLICT (event_id, name) DO NOTHING;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      v_name := COALESCE(NULLIF(TRIM(v_row->>'name'), ''), NULLIF(TRIM(v_row->>'participant_name'), ''));
      IF v_name IS NULL THEN
        v_skipped := v_skipped + 1;
        v_errors := array_append(v_errors, format('Row %s: name is required', v_idx));
        CONTINUE;
      END IF;

      v_email := NULLIF(TRIM(COALESCE(v_row->>'email', v_row->>'participant_email', '')), '');
      v_group := NULLIF(TRIM(COALESCE(v_row->>'group', v_row->>'participant_group', '')), '');
      v_part_id := gen_random_uuid();

      v_qr := json_build_object(
        'participant_id', v_part_id::text,
        'event_id', p_event_id::text,
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
        participant_group,
        form_data,
        qr_data,
        attendance_status,
        attended_at,
        registration_source
      )
      VALUES (
        v_part_id,
        p_event_id,
        NULL,
        v_user_id,
        v_name,
        v_email,
        v_group,
        jsonb_build_object('added_manually', true, 'bulk_import', true, 'group', COALESCE(v_group, '')),
        v_qr::text,
        'registered',
        NULL,
        'bulk_import'
      );

      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      v_errors := array_append(v_errors, format('Row %s: %s', v_idx, SQLERRM));
    END;
  END LOOP;

  RETURN json_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_import_event_participants(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_import_event_participants(uuid, jsonb) TO authenticated;
