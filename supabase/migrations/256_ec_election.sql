-- Executive Committee election: contesting, voting, delayed results.

CREATE TABLE IF NOT EXISTS public.ec_elections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tab_visible BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'nominations'
    CHECK (status IN ('nominations', 'voting', 'closed')),
  results_visible BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  results_shown_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ec_elections_singleton ON public.ec_elections ((true));

INSERT INTO public.ec_elections (tab_visible, status, results_visible)
SELECT false, 'nominations', false
WHERE NOT EXISTS (SELECT 1 FROM public.ec_elections);

CREATE TABLE IF NOT EXISTS public.ec_election_contestants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES public.ec_elections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('secretary', 'joint_secretary', 'treasurer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ec_election_contestants_election
  ON public.ec_election_contestants (election_id, category);

CREATE TABLE IF NOT EXISTS public.ec_election_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES public.ec_elections(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contestant_id UUID NOT NULL REFERENCES public.ec_election_contestants(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('secretary', 'joint_secretary', 'treasurer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, voter_id, contestant_id)
);

CREATE INDEX IF NOT EXISTS idx_ec_election_votes_election
  ON public.ec_election_votes (election_id, category, voter_id);

ALTER TABLE public.ec_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_election_contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ec_election_votes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ec_norm_pos(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(coalesce(p, ''))), '[\s-]+', '_', 'g');
$$;

CREATE OR REPLACE FUNCTION public.is_ec_election_admin(p_uid uuid)
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
        p.is_admin IS TRUE
        OR p.role::text IN ('super_admin', 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ec_election_manager(p_uid uuid)
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
        p.is_admin IS TRUE
        OR p.is_faculty IS TRUE
        OR p.role::text IN ('admin', 'faculty_advisor', 'super_admin')
      )
  )
  OR EXISTS (
    SELECT 1
    FROM committee_members cm
    JOIN committees c ON c.id = cm.committee_id
    WHERE cm.user_id = p_uid
      AND lower(trim(c.name)) LIKE '%social%'
      AND lower(trim(c.name)) LIKE '%environment%'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_committee_head_user(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.user_id = p_uid
      AND public.ec_norm_pos(cm.position::text) IN ('head', 'committee_head')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_committee_head_or_cohead_user(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.user_id = p_uid
      AND public.ec_norm_pos(cm.position::text) IN (
        'head', 'committee_head', 'co_head', 'cohead', 'committee_cohead'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ec_current_election_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.ec_elections LIMIT 1;
$$;

DROP POLICY IF EXISTS "ec_elections_select" ON public.ec_elections;
CREATE POLICY "ec_elections_select" ON public.ec_elections
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ec_election_contestants_select" ON public.ec_election_contestants;
CREATE POLICY "ec_election_contestants_select" ON public.ec_election_contestants
  FOR SELECT TO authenticated
  USING (
    public.is_ec_election_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.ec_elections e
      WHERE e.id = election_id AND e.tab_visible = true
    )
  );

DROP POLICY IF EXISTS "ec_election_votes_select" ON public.ec_election_votes;
CREATE POLICY "ec_election_votes_select" ON public.ec_election_votes
  FOR SELECT TO authenticated
  USING (
    voter_id = auth.uid()
    OR public.is_ec_election_admin(auth.uid())
  );

REVOKE INSERT, UPDATE, DELETE ON public.ec_elections FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ec_election_contestants FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ec_election_votes FROM authenticated, anon;
GRANT SELECT ON public.ec_elections TO authenticated;
GRANT SELECT ON public.ec_election_contestants TO authenticated;
GRANT SELECT ON public.ec_election_votes TO authenticated;

CREATE OR REPLACE FUNCTION public.ec_election_touch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ec_elections SET updated_at = NOW() WHERE id = public.ec_current_election_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_open_tab()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF e.status = 'closed' AND e.results_visible THEN
    DELETE FROM public.ec_election_contestants WHERE election_id = e.id;
    UPDATE public.ec_elections
    SET tab_visible = true,
        status = 'nominations',
        results_visible = false,
        started_at = NULL,
        stopped_at = NULL,
        results_shown_at = NULL,
        updated_at = NOW()
    WHERE id = e.id;
  ELSE
    UPDATE public.ec_elections
    SET tab_visible = true, updated_at = NOW()
    WHERE id = e.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_hide_tab()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.ec_elections
  SET tab_visible = false, updated_at = NOW()
  WHERE id = public.ec_current_election_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_start()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF NOT e.tab_visible THEN
    RAISE EXCEPTION 'Open the election first';
  END IF;
  IF e.status <> 'nominations' THEN
    RAISE EXCEPTION 'Election already started';
  END IF;
  UPDATE public.ec_elections
  SET status = 'voting',
      started_at = NOW(),
      results_visible = false,
      updated_at = NOW()
  WHERE id = e.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_stop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF e.status <> 'voting' THEN
    RAISE EXCEPTION 'Election is not running';
  END IF;
  UPDATE public.ec_elections
  SET status = 'closed',
      stopped_at = NOW(),
      updated_at = NOW()
  WHERE id = e.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_show_results()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF e.status <> 'closed' THEN
    RAISE EXCEPTION 'Stop the election first';
  END IF;
  UPDATE public.ec_elections
  SET results_visible = true,
      results_shown_at = NOW(),
      updated_at = NOW()
  WHERE id = e.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_new()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  eid := public.ec_current_election_id();
  DELETE FROM public.ec_election_contestants WHERE election_id = eid;
  UPDATE public.ec_elections
  SET status = 'nominations',
      results_visible = false,
      started_at = NULL,
      stopped_at = NULL,
      results_shown_at = NULL,
      updated_at = NOW()
  WHERE id = eid;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_contest(p_category text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_category NOT IN ('secretary', 'joint_secretary', 'treasurer') THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;
  IF NOT public.is_committee_head_user(uid) THEN
    RAISE EXCEPTION 'Only committee heads can contest';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF NOT e.tab_visible OR e.status <> 'nominations' THEN
    RAISE EXCEPTION 'Contesting is closed';
  END IF;
  INSERT INTO public.ec_election_contestants (election_id, user_id, category)
  VALUES (e.id, uid, p_category);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Already contesting a category';
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_walk_out()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF e.status <> 'nominations' THEN
    RAISE EXCEPTION 'Walk out is closed';
  END IF;
  DELETE FROM public.ec_election_contestants
  WHERE election_id = e.id AND user_id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_cast_votes(p_category text, p_contestant_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
  uid uuid := auth.uid();
  n int;
  valid_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_category NOT IN ('secretary', 'joint_secretary', 'treasurer') THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;
  IF NOT public.is_committee_head_or_cohead_user(uid) THEN
    RAISE EXCEPTION 'Only heads and co-heads can vote';
  END IF;
  n := coalesce(array_length(p_contestant_ids, 1), 0);
  IF n < 1 OR n > 2 THEN
    RAISE EXCEPTION 'Select 1 or 2 contestants';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF NOT e.tab_visible OR e.status <> 'voting' THEN
    RAISE EXCEPTION 'Voting is closed';
  END IF;
  SELECT count(*) INTO valid_count
  FROM public.ec_election_contestants c
  WHERE c.election_id = e.id
    AND c.category = p_category
    AND c.id = ANY (p_contestant_ids);
  IF valid_count <> n THEN
    RAISE EXCEPTION 'Invalid contestants';
  END IF;
  DELETE FROM public.ec_election_votes
  WHERE election_id = e.id AND voter_id = uid AND category = p_category;
  INSERT INTO public.ec_election_votes (election_id, voter_id, contestant_id, category)
  SELECT e.id, uid, x, p_category
  FROM unnest(p_contestant_ids) AS x;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  e public.ec_elections%ROWTYPE;
  can_manage boolean;
  can_live boolean;
  contestants jsonb;
  my_votes jsonb;
  tally jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  can_manage := public.is_ec_election_manager(uid);
  IF NOT e.tab_visible AND NOT can_manage THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;
  can_live := public.is_ec_election_admin(uid) OR e.results_visible;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'user_id', c.user_id,
    'name', coalesce(p.name, 'Member'),
    'category', c.category,
    'created_at', c.created_at
  ) ORDER BY c.created_at), '[]'::jsonb)
  INTO contestants
  FROM public.ec_election_contestants c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.election_id = e.id;

  SELECT coalesce(jsonb_object_agg(category, ids), '{}'::jsonb)
  INTO my_votes
  FROM (
    SELECT v.category, coalesce(jsonb_agg(v.contestant_id), '[]'::jsonb) AS ids
    FROM public.ec_election_votes v
    WHERE v.election_id = e.id AND v.voter_id = uid
    GROUP BY v.category
  ) s;

  IF can_live THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'contestant_id', c.id,
      'user_id', c.user_id,
      'name', coalesce(p.name, 'Member'),
      'category', c.category,
      'votes', coalesce(vc.votes, 0),
      'created_at', c.created_at
    )), '[]'::jsonb)
    INTO tally
    FROM public.ec_election_contestants c
    JOIN public.profiles p ON p.id = c.user_id
    LEFT JOIN (
      SELECT contestant_id, count(*)::int AS votes
      FROM public.ec_election_votes
      WHERE election_id = e.id
      GROUP BY contestant_id
    ) vc ON vc.contestant_id = c.id
    WHERE c.election_id = e.id;
  ELSE
    tally := NULL;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'tab_visible', e.tab_visible,
    'status', e.status,
    'results_visible', e.results_visible,
    'can_manage', can_manage,
    'can_contest', public.is_committee_head_user(uid),
    'can_vote', public.is_committee_head_or_cohead_user(uid),
    'can_view_live', public.is_ec_election_admin(uid),
    'my_user_id', uid,
    'contestants', contestants,
    'my_votes', coalesce(my_votes, '{}'::jsonb),
    'tally', tally
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ec_norm_pos(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_ec_election_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_ec_election_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_committee_head_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_committee_head_or_cohead_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_current_election_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_touch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_open_tab() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_hide_tab() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_start() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_stop() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_show_results() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_new() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_contest(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_walk_out() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_cast_votes(text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_state() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_ec_election_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ec_election_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_committee_head_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_committee_head_or_cohead_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_open_tab() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_hide_tab() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_stop() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_show_results() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_new() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_contest(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_walk_out() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_cast_votes(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_open_tab() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_hide_tab() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_start() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_stop() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_show_results() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_new() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_contest(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_walk_out() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_cast_votes(text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_state() TO service_role;
