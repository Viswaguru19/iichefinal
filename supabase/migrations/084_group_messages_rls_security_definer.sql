-- group_messages INSERT/SELECT policies reference chat_groups + chat_participants.
-- Nested RLS on those tables can make EXISTS(...) false even when the user is a member.
-- This SECURITY DEFINER helper evaluates membership with definer rights (stable search_path).
--
-- Safe to re-run: drop membership policies first (in case only this file is re-applied).
DROP POLICY IF EXISTS "group_messages_select_by_membership" ON group_messages;
DROP POLICY IF EXISTS "group_messages_insert_by_membership" ON group_messages;

CREATE OR REPLACE FUNCTION public.auth_user_can_access_group_messages_channel(p_group_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_group_id IS NOT NULL
    AND btrim(p_group_id) <> ''
    AND (
      EXISTS (
        SELECT 1
        FROM chat_groups cg
        INNER JOIN chat_participants cp
          ON cp.group_id = cg.id
         AND cp.user_id = auth.uid()
        WHERE lower(trim(cg.id::text)) = lower(trim(p_group_id))
           OR (
             cg.committee_id IS NOT NULL
             AND lower(trim(cg.committee_id::text)) = lower(trim(p_group_id))
           )
      )
      OR lower(trim(p_group_id)) = 'iiche-main'
      OR (
        lower(trim(p_group_id)) = 'all-heads'
        AND EXISTS (
          SELECT 1 FROM committee_members
          WHERE user_id = auth.uid() AND position = 'head'
        )
      )
      OR (
        lower(trim(p_group_id)) = 'all-coheads'
        AND EXISTS (
          SELECT 1 FROM committee_members
          WHERE user_id = auth.uid() AND position = 'co_head'
        )
      )
      OR EXISTS (
        SELECT 1 FROM committee_members
        WHERE user_id = auth.uid()
          AND lower(trim(committee_id::text)) = lower(trim(p_group_id))
      )
    );
$$;

REVOKE ALL ON FUNCTION public.auth_user_can_access_group_messages_channel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_can_access_group_messages_channel(text) TO authenticated;

-- Remove legacy policy names (membership policies already dropped at top of file)
DROP POLICY IF EXISTS "Users can read group messages" ON group_messages;
DROP POLICY IF EXISTS "Users can send group messages" ON group_messages;
DROP POLICY IF EXISTS "Users can view messages in their groups" ON group_messages;
DROP POLICY IF EXISTS "Users can send messages to their groups" ON group_messages;

CREATE POLICY "group_messages_select_by_membership"
ON group_messages FOR SELECT
USING (public.auth_user_can_access_group_messages_channel(CAST(group_id AS text)));

CREATE POLICY "group_messages_insert_by_membership"
ON group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.auth_user_can_access_group_messages_channel(CAST(group_id AS text))
);
