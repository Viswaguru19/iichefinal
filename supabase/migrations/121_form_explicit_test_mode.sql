-- Explicit test mode via forms.settings.test_mode (not every draft).
-- Submit RPC marks responses as TEST only when this flag is on.

CREATE OR REPLACE FUNCTION public.form_is_test_mode(p_form forms)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((p_form.settings->>'test_mode')::boolean, false)
      OR COALESCE((p_form.settings->>'testMode')::boolean, false);
$$;

COMMENT ON FUNCTION public.form_is_test_mode(forms) IS
  'True when forms.settings.test_mode is on. Live Start Collecting should clear tests and set test_mode false.';
