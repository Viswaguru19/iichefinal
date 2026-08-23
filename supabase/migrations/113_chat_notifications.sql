-- Chat notifications: portal + push (via notifications INSERT webhook)
-- Fixes DM links and adds group message notifications.

CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  preview TEXT;
BEGIN
  IF NEW.receiver_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  preview := LEFT(
    COALESCE(
      NULLIF(TRIM(NEW.message), ''),
      CASE
        WHEN NEW.file_url IS NOT NULL THEN '📎 Attachment'
        WHEN NEW.poll_data IS NOT NULL THEN '📊 Poll'
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notify_on_message ON direct_messages;
CREATE TRIGGER trigger_notify_on_message
AFTER INSERT ON direct_messages
FOR EACH ROW EXECUTE FUNCTION notify_on_message();

CREATE OR REPLACE FUNCTION notify_on_group_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  group_label TEXT;
  preview TEXT;
  recipient RECORD;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  SELECT COALESCE(NULLIF(TRIM(cg.name), ''), 'Group chat') INTO group_label
  FROM chat_groups cg
  WHERE cg.id::text = NEW.group_id
     OR (cg.committee_id IS NOT NULL AND cg.committee_id::text = NEW.group_id)
  LIMIT 1;

  preview := LEFT(
    COALESCE(
      NULLIF(TRIM(NEW.message), ''),
      CASE
        WHEN NEW.file_url IS NOT NULL THEN '📎 Attachment'
        WHEN NEW.poll_data IS NOT NULL THEN '📊 Poll'
        ELSE 'New message'
      END
    ),
    120
  );

  FOR recipient IN
    SELECT cp.user_id
    FROM chat_participants cp
    INNER JOIN chat_groups cg ON cg.id = cp.group_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notify_on_group_message ON group_messages;
CREATE TRIGGER trigger_notify_on_group_message
AFTER INSERT ON group_messages
FOR EACH ROW EXECUTE FUNCTION notify_on_group_message();
