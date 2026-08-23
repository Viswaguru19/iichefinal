-- Annual transition: promote all co-heads on regular committees to head; reversible via latest snapshot (for testing / rollback).

CREATE TABLE IF NOT EXISTS cohead_promotion_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  member_ids UUID[] NOT NULL,
  reversed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cohead_promotion_snapshots_created ON cohead_promotion_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cohead_promotion_snapshots_active ON cohead_promotion_snapshots(reversed_at) WHERE reversed_at IS NULL;

ALTER TABLE cohead_promotion_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cohead_snapshots_no_direct" ON cohead_promotion_snapshots;
CREATE POLICY "cohead_snapshots_no_direct" ON cohead_promotion_snapshots
  FOR ALL USING (false);

COMMENT ON TABLE cohead_promotion_snapshots IS
  'Records committee_member rows promoted co_head→head; reverse_last restores the latest non-reversed snapshot.';

-- Same gate as admin dashboard: faculty, admin flag, or key chapter roles
CREATE OR REPLACE FUNCTION public.can_access_admin_panel(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_uid
      AND (
        p.is_faculty IS TRUE
        OR p.is_admin IS TRUE
        OR p.executive_role IS NOT NULL
        OR p.role::text IN (
          'admin',
          'faculty_advisor',
          'secretary',
          'program_head',
          'super_admin'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_admin_panel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_admin_panel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_admin_panel(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.promote_coheads_to_heads()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  ids uuid[];
  n int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.can_access_admin_panel(v_uid) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(array_agg(cm.id ORDER BY cm.id), ARRAY[]::uuid[])
  INTO ids
  FROM committee_members cm
  INNER JOIN committees c ON c.id = cm.committee_id
  WHERE cm.position = 'co_head'::member_position
    AND c.type = 'regular'::committee_type;

  IF ids IS NULL OR cardinality(ids) = 0 THEN
    RETURN json_build_object(
      'ok', true,
      'promoted', 0,
      'message', 'No co-heads on regular committees to promote'
    );
  END IF;

  INSERT INTO cohead_promotion_snapshots (created_by, member_ids)
  VALUES (v_uid, ids);

  UPDATE committee_members
  SET position = 'head'::member_position
  WHERE id = ANY (ids);

  GET DIAGNOSTICS n = ROW_COUNT;

  RETURN json_build_object('ok', true, 'promoted', n);
END;
$$;

REVOKE ALL ON FUNCTION public.promote_coheads_to_heads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_coheads_to_heads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_coheads_to_heads() TO service_role;

CREATE OR REPLACE FUNCTION public.reverse_last_cohead_promotion()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  snap_id uuid;
  mids uuid[];
  n int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.can_access_admin_panel(v_uid) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT s.id, s.member_ids
  INTO snap_id, mids
  FROM cohead_promotion_snapshots s
  WHERE s.reversed_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF snap_id IS NULL OR mids IS NULL OR cardinality(mids) = 0 THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'no_snapshot',
      'message', 'Nothing to reverse. Promote co-heads first, or the last snapshot was already reversed.'
    );
  END IF;

  UPDATE committee_members
  SET position = 'co_head'::member_position
  WHERE id = ANY (mids);

  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE cohead_promotion_snapshots
  SET reversed_at = now()
  WHERE id = snap_id;

  RETURN json_build_object('ok', true, 'reverted', n, 'snapshot_id', snap_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_last_cohead_promotion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_last_cohead_promotion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_last_cohead_promotion() TO service_role;
