-- Public event registration: QR opens /forms/[id] without login; anon can submit + sync event_participants

-- Ensure column exists (older DBs may have event_participants without it)
ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS form_response_id UUID REFERENCES form_responses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_event_participants_form_response_id ON event_participants(form_response_id);

-- Anyone (including anon) can read active event registration forms
DROP POLICY IF EXISTS "forms_select_public_event_registration" ON forms;
CREATE POLICY "forms_select_public_event_registration"
ON forms FOR SELECT
USING (
  is_active = true
  AND form_type = 'event_registration'
);

-- Anonymous responses when form does not require login and is not internal-only
DROP POLICY IF EXISTS "form_responses_insert_anon_event_registration" ON form_responses;
CREATE POLICY "form_responses_insert_anon_event_registration"
ON form_responses FOR INSERT
WITH CHECK (
  auth.uid() IS NULL
  AND user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id::text = form_responses.form_id::text
      AND f.is_active = true
      AND f.form_type = 'event_registration'
      AND COALESCE((f.settings->>'require_login')::boolean, (f.settings->>'requireLogin')::boolean, false) = false
      AND COALESCE(NULLIF(f.settings->>'access_type', ''), NULLIF(f.settings->>'accessType', ''), 'public') <> 'internal'
  )
);

-- Anonymous participant row linked to that response (client insert after form_responses)
DROP POLICY IF EXISTS "event_participants_insert_anon_by_response" ON event_participants;
CREATE POLICY "event_participants_insert_anon_by_response"
ON event_participants FOR INSERT
WITH CHECK (
  auth.uid() IS NULL
  AND EXISTS (
    SELECT 1
    FROM form_responses fr
    JOIN forms f ON f.id::text = fr.form_id::text
    WHERE fr.id = event_participants.form_response_id
      AND fr.user_id IS NULL
      AND f.form_type = 'event_registration'
      AND f.is_active = true
  )
);
