-- Allow read/send on UUID chat_groups (Official, Unofficial, EC, committee, custom).

DROP POLICY IF EXISTS "Members can view uuid group messages" ON public.group_messages;
CREATE POLICY "Members can view uuid group messages"
ON public.group_messages FOR SELECT
USING (
  sender_id = auth.uid()
  OR (
    group_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_chat_group_member(group_id::uuid)
  )
);

DROP POLICY IF EXISTS "Members can send uuid group messages" ON public.group_messages;
CREATE POLICY "Members can send uuid group messages"
ON public.group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND group_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_chat_group_member(group_id::uuid)
);

DROP POLICY IF EXISTS "Members can update own uuid group messages" ON public.group_messages;
CREATE POLICY "Members can update own uuid group messages"
ON public.group_messages FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());
