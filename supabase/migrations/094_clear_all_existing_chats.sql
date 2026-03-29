-- Clear all existing chat history for everyone.
-- This keeps users, groups, and memberships; only message history is removed.
-- Safe to run across mixed schema versions where some chat tables may not exist.

DO $$
BEGIN
  IF to_regclass('public.message_forwards') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.message_forwards';
  END IF;

  IF to_regclass('public.message_reactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.message_reactions';
  END IF;

  IF to_regclass('public.message_read_status') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.message_read_status';
  END IF;

  IF to_regclass('public.typing_indicators') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.typing_indicators';
  END IF;

  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.chat_messages';
  END IF;

  IF to_regclass('public.group_messages') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.group_messages';
  END IF;

  IF to_regclass('public.direct_messages') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.direct_messages';
  END IF;

  -- Reset read markers so chat list starts clean after purge.
  IF to_regclass('public.chat_participants') IS NOT NULL THEN
    EXECUTE 'UPDATE public.chat_participants SET last_read_at = NOW()';
  END IF;
END;
$$;

