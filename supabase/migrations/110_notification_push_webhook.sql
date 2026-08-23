-- Auto Web Push when a portal notification row is inserted (free VAPID push).
-- After running this migration, set Supabase secrets (SQL editor):
--   ALTER DATABASE postgres SET app.push_webhook_url = 'https://YOUR-DOMAIN/api/push/dispatch-internal';
--   ALTER DATABASE postgres SET app.push_webhook_secret = 'YOUR_PUSH_WEBHOOK_SECRET';
-- Also add PUSH_WEBHOOK_SECRET to your Next.js / Vercel env (same value).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_push_on_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  BEGIN
    v_url := current_setting('app.push_webhook_url', true);
    v_secret := current_setting('app.push_webhook_secret', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/dashboard')
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_push_webhook ON public.notifications;
CREATE TRIGGER trg_notifications_push_webhook
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_notification_insert();
