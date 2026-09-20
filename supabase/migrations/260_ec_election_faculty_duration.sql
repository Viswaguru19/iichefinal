-- Faculty can remove nominations with a reason.
-- Each post uses only the first 2 remaining nominations on the ballot.
-- Managers set a voting duration; voting auto-closes when it ends.

ALTER TABLE public.ec_elections
  ADD COLUMN IF NOT EXISTS voting_minutes integer,
  ADD COLUMN IF NOT EXISTS voting_ends_at timestamptz;

ALTER TABLE public.ec_election_contestants
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removal_reason text;

CREATE OR REPLACE FUNCTION public.is_ec_election_faculty(p_uid uuid)
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
        OR p.role::text IN ('faculty_advisor', 'admin', 'super_admin')
        OR p.is_admin IS TRUE
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ec_election_maybe_close()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ec_elections
  SET status = 'closed',
      stopped_at = coalesce(stopped_at, NOW()),
      updated_at = NOW()
  WHERE status = 'voting'
    AND voting_ends_at IS NOT NULL
    AND voting_ends_at <= NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_on_election_ballot(p_election_id uuid, p_contestant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT c.id
      FROM public.ec_election_contestants c
      WHERE c.election_id = p_election_id
        AND c.removed_at IS NULL
        AND c.category = (
          SELECT category FROM public.ec_election_contestants WHERE id = p_contestant_id
        )
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT 2
    ) ballot
    WHERE ballot.id = p_contestant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.ec_election_set_duration(p_minutes integer)
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
  IF p_minutes IS NULL OR p_minutes < 1 OR p_minutes > 10080 THEN
    RAISE EXCEPTION 'Duration must be between 1 minute and 7 days';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF e.status = 'closed' AND e.results_visible THEN
    RAISE EXCEPTION 'Start a new election first';
  END IF;
  UPDATE public.ec_elections
  SET voting_minutes = p_minutes,
      voting_ends_at = CASE
        WHEN status = 'voting' AND started_at IS NOT NULL
          THEN started_at + make_interval(mins => p_minutes)
        ELSE voting_ends_at
      END,
      updated_at = NOW()
  WHERE id = e.id;
  PERFORM public.ec_election_maybe_close();
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_remove_nomination(p_contestant_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
  reason text := trim(coalesce(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_faculty(auth.uid()) THEN
    RAISE EXCEPTION 'Only faculty can remove a nomination';
  END IF;
  IF char_length(reason) < 3 THEN
    RAISE EXCEPTION 'Enter a reason';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF e.status <> 'nominations' THEN
    RAISE EXCEPTION 'Nominations can only be removed before voting starts';
  END IF;
  UPDATE public.ec_election_contestants
  SET removed_at = NOW(),
      removed_by = auth.uid(),
      removal_reason = reason
  WHERE id = p_contestant_id
    AND election_id = e.id
    AND removed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nomination not found';
  END IF;
  PERFORM public.ec_election_touch();
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
  IF e.voting_minutes IS NULL OR e.voting_minutes < 1 THEN
    RAISE EXCEPTION 'Set the election duration first';
  END IF;
  UPDATE public.ec_elections
  SET status = 'voting',
      started_at = NOW(),
      results_visible = false,
      voting_ends_at = NOW() + make_interval(mins => e.voting_minutes),
      updated_at = NOW()
  WHERE id = e.id;
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
        roles_applied = false,
        started_at = NULL,
        stopped_at = NULL,
        results_shown_at = NULL,
        voting_minutes = NULL,
        voting_ends_at = NULL,
        updated_at = NOW()
    WHERE id = e.id;
  ELSE
    UPDATE public.ec_elections
    SET tab_visible = true, updated_at = NOW()
    WHERE id = e.id;
  END IF;
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
      roles_applied = false,
      started_at = NULL,
      stopped_at = NULL,
      results_shown_at = NULL,
      voting_minutes = NULL,
      voting_ends_at = NULL,
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
  IF p_category = 'secretary' THEN
    IF NOT public.is_committee_head_user(uid) THEN
      RAISE EXCEPTION 'Only committee heads can contest Secretary';
    END IF;
  ELSIF NOT public.is_committee_cohead_user(uid) THEN
    RAISE EXCEPTION 'Only co-heads can contest this category';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF NOT e.tab_visible OR e.status <> 'nominations' THEN
    RAISE EXCEPTION 'Contesting is closed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ec_election_contestants
    WHERE election_id = e.id AND user_id = uid AND removed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This nomination was removed';
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
  WHERE election_id = e.id AND user_id = uid AND removed_at IS NULL;
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
  cid uuid;
BEGIN
  PERFORM public.ec_election_maybe_close();
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
  FOREACH cid IN ARRAY p_contestant_ids LOOP
    IF NOT public.ec_on_election_ballot(e.id, cid) THEN
      RAISE EXCEPTION 'Only 2 candidates are on the ballot';
    END IF;
  END LOOP;
  SELECT count(*) INTO valid_count
  FROM public.ec_election_contestants c
  WHERE c.election_id = e.id
    AND c.category = p_category
    AND c.removed_at IS NULL
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

CREATE OR REPLACE FUNCTION public.ec_election_apply_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
  winner_count int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF NOT e.results_visible THEN
    RAISE EXCEPTION 'Publish results first';
  END IF;
  IF e.roles_applied THEN
    RAISE EXCEPTION 'Roles already changed';
  END IF;

  CREATE TEMP TABLE _ec_winners (
    user_id uuid PRIMARY KEY,
    exec_role text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _ec_winners (user_id, exec_role)
  SELECT user_id, exec_role
  FROM (
    SELECT
      ranked.user_id,
      CASE
        WHEN ranked.category = 'secretary' AND ranked.rn = 1 THEN 'secretary'
        WHEN ranked.category = 'secretary' AND ranked.rn = 2 THEN 'associate_secretary'
        WHEN ranked.category = 'joint_secretary' AND ranked.rn = 1 THEN 'joint_secretary'
        WHEN ranked.category = 'joint_secretary' AND ranked.rn = 2 THEN 'associate_joint_secretary'
        WHEN ranked.category = 'treasurer' AND ranked.rn = 1 THEN 'treasurer'
        WHEN ranked.category = 'treasurer' AND ranked.rn = 2 THEN 'associate_treasurer'
      END AS exec_role
    FROM (
      SELECT
        c.user_id,
        c.category,
        ROW_NUMBER() OVER (
          PARTITION BY c.category
          ORDER BY coalesce(vc.votes, 0) DESC, c.created_at ASC
        ) AS rn
      FROM public.ec_election_contestants c
      LEFT JOIN (
        SELECT contestant_id, count(*)::int AS votes
        FROM public.ec_election_votes
        WHERE election_id = e.id
        GROUP BY contestant_id
      ) vc ON vc.contestant_id = c.id
      WHERE c.election_id = e.id
        AND c.removed_at IS NULL
        AND public.ec_on_election_ballot(e.id, c.id)
    ) ranked
    WHERE ranked.rn <= 2
  ) mapped
  WHERE exec_role IS NOT NULL;

  SELECT count(*) INTO winner_count FROM _ec_winners;
  IF winner_count = 0 THEN
    RAISE EXCEPTION 'No winners to assign';
  END IF;

  UPDATE public.profiles
  SET executive_role = NULL,
      election_celebrate = false,
      updated_at = NOW()
  WHERE executive_role IS NOT NULL
    AND id NOT IN (SELECT user_id FROM _ec_winners);

  UPDATE public.profiles p
  SET executive_role = w.exec_role,
      election_celebrate = true,
      updated_at = NOW()
  FROM _ec_winners w
  WHERE p.id = w.user_id;

  UPDATE public.ec_elections
  SET roles_applied = true,
      updated_at = NOW()
  WHERE id = e.id;
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
  is_admin boolean;
  can_remove boolean;
  can_live boolean;
  contestants jsonb;
  my_votes jsonb;
  tally jsonb;
  ballots jsonb;
  removals jsonb;
BEGIN
  PERFORM public.ec_election_maybe_close();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  can_manage := public.is_ec_election_manager(uid);
  IF NOT e.tab_visible AND NOT can_manage THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;
  is_admin := public.is_ec_election_admin(uid);
  can_remove := public.is_ec_election_faculty(uid);
  can_live := is_admin OR e.results_visible;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'user_id', c.user_id,
    'name', coalesce(p.name, 'Member'),
    'avatar_url', p.avatar_url,
    'category', c.category,
    'created_at', c.created_at,
    'on_ballot', public.ec_on_election_ballot(e.id, c.id)
  ) ORDER BY c.created_at), '[]'::jsonb)
  INTO contestants
  FROM public.ec_election_contestants c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.election_id = e.id
    AND c.removed_at IS NULL;

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
      'avatar_url', p.avatar_url,
      'category', c.category,
      'votes', coalesce(vc.votes, 0),
      'created_at', c.created_at,
      'on_ballot', public.ec_on_election_ballot(e.id, c.id)
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
    WHERE c.election_id = e.id
      AND c.removed_at IS NULL
      AND public.ec_on_election_ballot(e.id, c.id);
  ELSE
    tally := NULL;
  END IF;

  IF is_admin THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'voter_name', coalesce(vp.name, 'Member'),
      'contestant_name', coalesce(cp.name, 'Member'),
      'contestant_id', v.contestant_id,
      'category', v.category
    ) ORDER BY v.category, vp.name, cp.name), '[]'::jsonb)
    INTO ballots
    FROM public.ec_election_votes v
    JOIN public.profiles vp ON vp.id = v.voter_id
    JOIN public.ec_election_contestants c ON c.id = v.contestant_id
    JOIN public.profiles cp ON cp.id = c.user_id
    WHERE v.election_id = e.id;
  ELSE
    ballots := NULL;
  END IF;

  IF can_remove OR can_manage THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', coalesce(p.name, 'Member'),
      'category', c.category,
      'reason', c.removal_reason,
      'removed_at', c.removed_at
    ) ORDER BY c.removed_at DESC), '[]'::jsonb)
    INTO removals
    FROM public.ec_election_contestants c
    JOIN public.profiles p ON p.id = c.user_id
    WHERE c.election_id = e.id AND c.removed_at IS NOT NULL;
  ELSE
    removals := NULL;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'tab_visible', e.tab_visible,
    'status', e.status,
    'results_visible', e.results_visible,
    'roles_applied', e.roles_applied,
    'voting_minutes', e.voting_minutes,
    'voting_ends_at', e.voting_ends_at,
    'can_manage', can_manage,
    'can_remove', can_remove,
    'can_contest', jsonb_build_object(
      'secretary', public.is_committee_head_user(uid),
      'joint_secretary', public.is_committee_cohead_user(uid),
      'treasurer', public.is_committee_cohead_user(uid)
    ),
    'can_vote', public.is_committee_head_or_cohead_user(uid),
    'can_view_live', is_admin,
    'my_user_id', uid,
    'contestants', contestants,
    'my_votes', coalesce(my_votes, '{}'::jsonb),
    'tally', tally,
    'ballots', ballots,
    'removals', removals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_ec_election_faculty(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_maybe_close() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_on_election_ballot(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_set_duration(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_remove_nomination(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_ec_election_faculty(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_set_duration(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_remove_nomination(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_start() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_open_tab() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_new() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_contest(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_walk_out() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_cast_votes(text, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_apply_roles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_state() TO authenticated, service_role;
