-- Contest names stay private until faculty finalizes.
-- Faculty or social committee then open voting.
-- Results publish on stop, time up, or when every eligible member has voted.

ALTER TABLE public.ec_elections
  ADD COLUMN IF NOT EXISTS contestants_finalized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contestants_finalized_at TIMESTAMPTZ;

UPDATE public.ec_elections
SET contestants_finalized = true,
    contestants_finalized_at = coalesce(contestants_finalized_at, updated_at)
WHERE status IN ('voting', 'closed')
  AND contestants_finalized = false;

DROP POLICY IF EXISTS "ec_election_contestants_select" ON public.ec_election_contestants;
CREATE POLICY "ec_election_contestants_select" ON public.ec_election_contestants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ec_election_admin(auth.uid())
    OR public.is_ec_election_faculty(auth.uid())
    OR (
      removed_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.ec_elections e
        WHERE e.id = election_id
          AND e.tab_visible = true
          AND e.contestants_finalized = true
      )
    )
  );

CREATE OR REPLACE FUNCTION public.ec_election_all_eligible_voted(p_election_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT DISTINCT cm.user_id
    FROM public.committee_members cm
    WHERE public.ec_norm_pos(cm.position::text) IN (
      'head', 'committee_head', 'co_head', 'cohead', 'committee_cohead'
    )
  ),
  ballot_cats AS (
    SELECT DISTINCT c.category
    FROM public.ec_election_contestants c
    WHERE c.election_id = p_election_id
      AND c.removed_at IS NULL
      AND public.ec_on_election_ballot(p_election_id, c.id)
  )
  SELECT
    EXISTS (SELECT 1 FROM eligible)
    AND EXISTS (SELECT 1 FROM ballot_cats)
    AND NOT EXISTS (
      SELECT 1
      FROM eligible ev
      CROSS JOIN ballot_cats bc
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.ec_election_votes v
        WHERE v.election_id = p_election_id
          AND v.voter_id = ev.user_id
          AND v.category = bc.category
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.ec_election_publish_now(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ec_elections
  SET status = 'closed',
      stopped_at = coalesce(stopped_at, NOW()),
      results_visible = true,
      results_shown_at = coalesce(results_shown_at, NOW()),
      updated_at = NOW()
  WHERE id = p_id
    AND status = 'voting';
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_maybe_close()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF e.id IS NULL OR e.status <> 'voting' THEN
    RETURN;
  END IF;
  IF (e.voting_ends_at IS NOT NULL AND e.voting_ends_at <= NOW())
     OR public.ec_election_all_eligible_voted(e.id) THEN
    PERFORM public.ec_election_publish_now(e.id);
  END IF;
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
  IF e.status = 'voting' THEN
    RAISE EXCEPTION 'Voting is already open';
  END IF;
  IF e.status = 'closed' AND e.results_visible THEN
    DELETE FROM public.ec_election_contestants WHERE election_id = e.id;
    UPDATE public.ec_elections
    SET tab_visible = true,
        status = 'nominations',
        results_visible = false,
        roles_applied = false,
        contestants_finalized = false,
        contestants_finalized_at = NULL,
        started_at = NULL,
        stopped_at = NULL,
        results_shown_at = NULL,
        voting_minutes = NULL,
        voting_ends_at = NULL,
        updated_at = NOW()
    WHERE id = e.id;
  ELSE
    UPDATE public.ec_elections
    SET tab_visible = true,
        status = CASE WHEN status = 'closed' THEN 'nominations' ELSE status END,
        results_visible = false,
        updated_at = NOW()
    WHERE id = e.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_finalize_contestants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.ec_elections%ROWTYPE;
  left_count int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_ec_election_faculty(auth.uid()) THEN
    RAISE EXCEPTION 'Only faculty can finalize contestants';
  END IF;
  SELECT * INTO e FROM public.ec_elections LIMIT 1;
  IF NOT e.tab_visible OR e.status <> 'nominations' THEN
    RAISE EXCEPTION 'Start the election before finalizing contestants';
  END IF;
  IF e.contestants_finalized THEN
    RAISE EXCEPTION 'Contestants are already finalized';
  END IF;
  SELECT count(*) INTO left_count
  FROM public.ec_election_contestants
  WHERE election_id = e.id AND removed_at IS NULL;
  IF left_count < 1 THEN
    RAISE EXCEPTION 'Need at least one contestant before finalizing';
  END IF;
  UPDATE public.ec_elections
  SET contestants_finalized = true,
      contestants_finalized_at = NOW(),
      updated_at = NOW()
  WHERE id = e.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ec_election_open_voting()
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
    RAISE EXCEPTION 'Start the election first';
  END IF;
  IF e.status <> 'nominations' THEN
    RAISE EXCEPTION 'Voting cannot start in this state';
  END IF;
  IF NOT e.contestants_finalized THEN
    RAISE EXCEPTION 'Faculty must finalize contestants first';
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
BEGIN
  PERFORM public.ec_election_start();
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
  PERFORM public.ec_election_publish_now(e.id);
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
  IF e.status = 'voting' THEN
    PERFORM public.ec_election_publish_now(e.id);
    RETURN;
  END IF;
  IF e.status <> 'closed' THEN
    RAISE EXCEPTION 'Stop the election first';
  END IF;
  UPDATE public.ec_elections
  SET results_visible = true,
      results_shown_at = coalesce(results_shown_at, NOW()),
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
      roles_applied = false,
      contestants_finalized = false,
      contestants_finalized_at = NULL,
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
  IF NOT e.tab_visible OR e.status <> 'nominations' OR e.contestants_finalized THEN
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
  IF e.status <> 'nominations' OR e.contestants_finalized THEN
    RAISE EXCEPTION 'Walk out is closed';
  END IF;
  DELETE FROM public.ec_election_contestants
  WHERE election_id = e.id AND user_id = uid AND removed_at IS NULL;
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
  IF e.status <> 'nominations' OR e.contestants_finalized THEN
    RAISE EXCEPTION 'Nominations can only be removed before contestants are finalized';
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
  PERFORM public.ec_election_maybe_close();
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
  can_see_slate boolean;
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
  can_see_slate := is_admin OR can_remove OR e.contestants_finalized;
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
    AND c.removed_at IS NULL
    AND (can_see_slate OR c.user_id = uid);

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
    'contestants_finalized', e.contestants_finalized,
    'voting_minutes', e.voting_minutes,
    'voting_ends_at', e.voting_ends_at,
    'can_manage', can_manage,
    'can_remove', can_remove,
    'can_finalize', can_remove,
    'can_see_slate', can_see_slate,
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

REVOKE ALL ON FUNCTION public.ec_election_all_eligible_voted(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_publish_now(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_finalize_contestants() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ec_election_open_voting() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ec_election_finalize_contestants() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_open_voting() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_start() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_open_tab() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_stop() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_show_results() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_new() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_contest(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_walk_out() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_remove_nomination(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_cast_votes(text, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ec_election_state() TO authenticated, service_role;
