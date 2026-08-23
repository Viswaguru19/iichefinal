-- Migration: 090_ensure_default_chat_memberships
-- Idempotent: add current user to Whole Organization chat and all committee chats they belong to.
-- Fixes missing rows when profile/org trigger did not run or RLS timing issues.

CREATE OR REPLACE FUNCTION public.ensure_default_chat_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO chat_participants (group_id, user_id, joined_at)
  VALUES ('00000000-0000-0000-0000-000000000001', auth.uid(), now())
  ON CONFLICT (group_id, user_id) DO NOTHING;

  INSERT INTO chat_participants (group_id, user_id, joined_at)
  SELECT cg.id, cm.user_id, now()
  FROM committee_members cm
  INNER JOIN chat_groups cg
    ON cg.committee_id = cm.committee_id
   AND cg.chat_type = 'committee'
  WHERE cm.user_id = auth.uid()
  ON CONFLICT (group_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_chat_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_chat_memberships() TO authenticated;
