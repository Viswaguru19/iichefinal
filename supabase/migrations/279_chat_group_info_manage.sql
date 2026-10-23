-- Members can see the roster and edit group info / members (RLS no longer requires is_admin).

CREATE OR REPLACE FUNCTION public.is_chat_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_group_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_group_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_chat_group_members(p_group_id uuid)
RETURNS TABLE(user_id uuid, name text, avatar_url text, is_group_admin boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.is_chat_group_member(p_group_id)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND COALESCE(is_admin, false)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cp.user_id, p.name, p.avatar_url, COALESCE(cp.is_admin, false)
  FROM public.chat_participants cp
  JOIN public.profiles p ON p.id = cp.user_id
  WHERE cp.group_id = p_group_id
  ORDER BY p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_chat_group_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_chat_group_members(uuid) TO authenticated;

DROP POLICY IF EXISTS "Group admins can update groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Members can update group info" ON public.chat_groups;
CREATE POLICY "Members can update group info"
ON public.chat_groups FOR UPDATE
USING (public.is_chat_group_member(id))
WITH CHECK (public.is_chat_group_member(id));

DROP POLICY IF EXISTS "Users can view group participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view participants of their groups" ON public.chat_participants;
DROP POLICY IF EXISTS "Anyone can view participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Members can view group roster" ON public.chat_participants;
CREATE POLICY "Members can view group roster"
ON public.chat_participants FOR SELECT
USING (public.is_chat_group_member(group_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Group admins can add participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Members can add participants" ON public.chat_participants;
CREATE POLICY "Members can add participants"
ON public.chat_participants FOR INSERT
WITH CHECK (public.is_chat_group_member(group_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Group admins can remove participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Members can remove participants" ON public.chat_participants;
CREATE POLICY "Members can remove participants"
ON public.chat_participants FOR DELETE
USING (public.is_chat_group_member(group_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own participant record" ON public.chat_participants;
DROP POLICY IF EXISTS "Members can update participant records" ON public.chat_participants;
CREATE POLICY "Members can update participant records"
ON public.chat_participants FOR UPDATE
USING (public.is_chat_group_member(group_id) OR user_id = auth.uid())
WITH CHECK (public.is_chat_group_member(group_id) OR user_id = auth.uid());
