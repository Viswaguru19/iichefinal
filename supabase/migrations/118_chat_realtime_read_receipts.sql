-- Ensure chat tables emit realtime events for read receipts / live updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'direct_messages') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'group_messages') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chat_participants') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
