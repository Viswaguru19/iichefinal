-- After results: managers can assign winner EC posts and clear outgoing officers.
-- Winners see a one-time portal celebration; election tab bursts whenever results are public.

ALTER TABLE public.ec_elections
  ADD COLUMN IF NOT EXISTS roles_applied BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS election_celebrate BOOLEAN NOT NULL DEFAULT false;

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
      updated_at = NOW()
  WHERE id = eid;
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

CREATE OR REPLACE FUNCTION public.ec_election_ack_celebration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET election_celebrate = false,
      updated_at = NOW()
  WHERE id = auth.uid();
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
  can_live boolean;
  contestants jsonb;
  my_votes jsonb;
  tally jsonb;
  ballots jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  can_manage := public.is_ec_election_manager(uid);
  IF NOT e.tab_visible AND NOT can_manage THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;
  is_admin := public.is_ec_election_admin(uid);
  can_live := is_admin OR e.results_visible;

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

  RETURN jsonb_build_object(
    'allowed', true,
    'tab_visible', e.tab_visible,
    'status', e.status,
    'results_visible', e.results_visible,
    'roles_applied', e.roles_applied,
    'can_manage', can_manage,
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
    'ballots', ballots
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ec_election_apply_roles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_ack_celebration() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ec_election_apply_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_ack_celebration() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_apply_roles() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_ack_celebration() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_new() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_new() TO service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ec_election_state() TO service_role;
