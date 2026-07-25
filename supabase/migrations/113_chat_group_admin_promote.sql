-- Allow custom-group admins to promote/demote other members (is_admin).
-- Users can still update only their own row (last_read_at) via the existing policy.
-- Multiple UPDATE policies are OR'd, so both paths remain valid.

DROP POLICY IF EXISTS "Group admins can update participants" ON public.chat_participants;
CREATE POLICY "Group admins can update participants"
  ON public.chat_participants FOR UPDATE
  USING (
    group_id IN (
      SELECT cg.id
      FROM public.chat_groups cg
      JOIN public.chat_participants cp ON cp.group_id = cg.id
      WHERE cp.user_id = auth.uid()
        AND cp.is_admin = true
        AND cg.chat_type = 'custom_group'
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT cg.id
      FROM public.chat_groups cg
      JOIN public.chat_participants cp ON cp.group_id = cg.id
      WHERE cp.user_id = auth.uid()
        AND cp.is_admin = true
        AND cg.chat_type = 'custom_group'
    )
  );
