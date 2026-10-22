ALTER TABLE public.event_participant_email_sends
  ADD COLUMN IF NOT EXISTS error_summary text,
  ADD COLUMN IF NOT EXISTS failed_emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS sent_emails text[] NOT NULL DEFAULT '{}'::text[];
