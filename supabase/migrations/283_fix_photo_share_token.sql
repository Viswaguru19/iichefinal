-- Share tokens must not use gen_random_bytes: pgcrypto lives in schema
-- `extensions`, and these functions set search_path = public.

CREATE OR REPLACE FUNCTION create_event_photo_share(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  SELECT token INTO tok FROM event_photo_shares WHERE event_id = p_event_id;
  IF tok IS NOT NULL THEN
    RETURN tok;
  END IF;

  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO event_photo_shares (event_id, token, created_by)
  VALUES (p_event_id, tok, auth.uid());
  RETURN tok;
END;
$$;

CREATE OR REPLACE FUNCTION rotate_event_photo_share(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  DELETE FROM event_photo_shares WHERE event_id = p_event_id;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO event_photo_shares (event_id, token, created_by)
  VALUES (p_event_id, tok, auth.uid());
  RETURN tok;
END;
$$;

GRANT EXECUTE ON FUNCTION create_event_photo_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rotate_event_photo_share(uuid) TO authenticated;
