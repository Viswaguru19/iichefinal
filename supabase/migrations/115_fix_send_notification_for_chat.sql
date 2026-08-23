-- Fix DM send failure: notify triggers couldn't resolve send_notification
-- Error: function send_notification(uuid, text, text, unknown, text) does not exist
-- Cause: SECURITY DEFINER notify_* lacked search_path; string literal typed as unknown.

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_link)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
  preview TEXT;
BEGIN
  IF NEW.receiver_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  preview := LEFT(
    COALESCE(
      NULLIF(TRIM(NEW.message), ''),
      CASE
        WHEN NEW.file_url IS NOT NULL THEN 'Attachment'
        WHEN NEW.poll_data IS NOT NULL THEN 'Poll'
        ELSE 'New message'
      END
    ),
    120
  );

  PERFORM public.send_notification(
    NEW.receiver_id,
    COALESCE(sender_name, 'Someone') || ' messaged you',
    preview,
    'chat'::text,
    ('/chat?user=' || NEW.sender_id::text)::text
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_group_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
  group_label TEXT;
  preview TEXT;
  recipient RECORD;
BEGIN
  SELECT name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  SELECT COALESCE(NULLIF(TRIM(cg.name), ''), 'Group chat') INTO group_label
  FROM public.chat_groups cg
  WHERE cg.id::text = NEW.group_id
     OR (cg.committee_id IS NOT NULL AND cg.committee_id::text = NEW.group_id)
  LIMIT 1;

  preview := LEFT(
    COALESCE(
      NULLIF(TRIM(NEW.message), ''),
      CASE
        WHEN NEW.file_url IS NOT NULL THEN 'Attachment'
        WHEN NEW.poll_data IS NOT NULL THEN 'Poll'
        ELSE 'New message'
      END
    ),
    120
  );

  FOR recipient IN
    SELECT cp.user_id
    FROM public.chat_participants cp
    INNER JOIN public.chat_groups cg ON cg.id = cp.group_id
    WHERE cp.user_id != NEW.sender_id
      AND (
        cg.id::text = NEW.group_id
        OR (cg.committee_id IS NOT NULL AND cg.committee_id::text = NEW.group_id)
      )
  LOOP
    PERFORM public.send_notification(
      recipient.user_id,
      COALESCE(group_label, 'Group chat'),
      COALESCE(sender_name, 'Someone') || ': ' || preview,
      'chat'::text,
      ('/chat?group=' || NEW.group_id)::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_message ON public.direct_messages;
CREATE TRIGGER trigger_notify_on_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

DROP TRIGGER IF EXISTS trigger_notify_on_group_message ON public.group_messages;
CREATE TRIGGER trigger_notify_on_group_message
AFTER INSERT ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_group_message();
