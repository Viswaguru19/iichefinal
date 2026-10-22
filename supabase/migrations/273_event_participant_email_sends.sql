CREATE TABLE IF NOT EXISTS public.event_participant_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  subject text NOT NULL DEFAULT '',
  message_body text NOT NULL DEFAULT '',
  recipient_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  group_filter text
);

CREATE INDEX IF NOT EXISTS idx_event_participant_email_sends_event
  ON public.event_participant_email_sends (event_id, sent_at DESC);

ALTER TABLE public.event_participant_email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read participant email sends" ON public.event_participant_email_sends;
CREATE POLICY "Authenticated can read participant email sends"
  ON public.event_participant_email_sends FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert participant email sends" ON public.event_participant_email_sends;
CREATE POLICY "Authenticated can insert participant email sends"
  ON public.event_participant_email_sends FOR INSERT TO authenticated
  WITH CHECK (sent_by = auth.uid());
