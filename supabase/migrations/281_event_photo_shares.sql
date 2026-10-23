-- Public share links for an event's photos (unguessable token, no login to view).

CREATE TABLE IF NOT EXISTS event_photo_shares (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_photo_shares_token ON event_photo_shares(token);

ALTER TABLE event_photo_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view event photo shares" ON event_photo_shares;
CREATE POLICY "Members can view event photo shares"
ON event_photo_shares FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can insert event photo shares" ON event_photo_shares;
CREATE POLICY "Members can insert event photo shares"
ON event_photo_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can update event photo shares" ON event_photo_shares;
CREATE POLICY "Members can update event photo shares"
ON event_photo_shares FOR UPDATE TO authenticated USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL)
  )
);

DROP POLICY IF EXISTS "Members can delete event photo shares" ON event_photo_shares;
CREATE POLICY "Members can delete event photo shares"
ON event_photo_shares FOR DELETE TO authenticated USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL)
  )
);

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

CREATE OR REPLACE FUNCTION get_shared_event_photos(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'title', e.title,
    'event_date', e.event_date,
    'photos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'path', p.photo_url,
          'caption', p.caption
        ) ORDER BY p.created_at DESC
      )
      FROM event_photos p
      WHERE p.event_id = e.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM event_photo_shares s
  JOIN events e ON e.id = s.event_id
  WHERE s.token = trim(p_token);

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION create_event_photo_share(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION rotate_event_photo_share(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_shared_event_photos(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_event_photo_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rotate_event_photo_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_event_photos(text) TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE event_photo_shares TO authenticated;
