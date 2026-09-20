-- Removal reasons are visible only to admins (full list) and the removed member (their own).

DROP POLICY IF EXISTS "ec_election_contestants_select" ON public.ec_election_contestants;
CREATE POLICY "ec_election_contestants_select" ON public.ec_election_contestants
  FOR SELECT TO authenticated
  USING (
    (
      removed_at IS NULL
      AND (
        public.is_ec_election_manager(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.ec_elections e
          WHERE e.id = election_id AND e.tab_visible = true
        )
      )
    )
    OR user_id = auth.uid()
    OR public.is_ec_election_admin(auth.uid())
  );

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
  my_removal jsonb;
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

  IF is_admin THEN
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

  SELECT jsonb_build_object(
    'category', c.category,
    'reason', c.removal_reason,
    'removed_at', c.removed_at
  )
  INTO my_removal
  FROM public.ec_election_contestants c
  WHERE c.election_id = e.id
    AND c.user_id = uid
    AND c.removed_at IS NOT NULL
  LIMIT 1;

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
    'removals', removals,
    'my_removal', my_removal
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ec_election_state() TO authenticated, service_role;
