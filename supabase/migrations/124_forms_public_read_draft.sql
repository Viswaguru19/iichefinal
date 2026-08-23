-- Allow anyone with the link to READ public forms in draft / test mode.
-- Live collecting still uses is_active + status; this only unlocks SELECT for definition/preview.
-- (Previous policy required is_active=true, so draft links always showed "Form not found".)

DROP POLICY IF EXISTS "forms_select_public_open" ON forms;
CREATE POLICY "forms_select_public_open"
ON forms FOR SELECT
USING (
  COALESCE((settings->>'require_login')::boolean, (settings->>'requireLogin')::boolean, false) = false
  AND COALESCE(
        NULLIF(TRIM(settings->>'access_type'), ''),
        NULLIF(TRIM(settings->>'accessType'), ''),
        'public'
      ) <> 'internal'
);

-- Authenticated portal members can always read forms (list/edit/preview).
DROP POLICY IF EXISTS "forms_select" ON forms;
CREATE POLICY "forms_select"
ON forms FOR SELECT
USING (auth.uid() IS NOT NULL);
