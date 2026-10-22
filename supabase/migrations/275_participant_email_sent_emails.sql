ALTER TABLE public.event_participant_email_sends
  ADD COLUMN IF NOT EXISTS sent_emails text[] NOT NULL DEFAULT '{}'::text[];
