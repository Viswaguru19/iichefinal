CREATE TABLE IF NOT EXISTS public.outlook_mail_connections (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  mailbox text NOT NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  access_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outlook_mail_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to outlook tokens" ON public.outlook_mail_connections;
CREATE POLICY "No client access to outlook tokens"
  ON public.outlook_mail_connections
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
