-- Ensure receivers can mark DMs as read (badge must stay cleared after reload).
DROP POLICY IF EXISTS "Users can update own received messages" ON public.direct_messages;
CREATE POLICY "Users can update own received messages"
  ON public.direct_messages FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Ensure participants can update their own last_read_at.
DROP POLICY IF EXISTS "Users can update own participant record" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_participants_update_own" ON public.chat_participants;
CREATE POLICY "Users can update own participant record"
  ON public.chat_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
