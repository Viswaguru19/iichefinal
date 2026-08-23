-- Event participants and attendance tracking

CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  form_response_id UUID REFERENCES form_responses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  participant_email TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  qr_data TEXT UNIQUE,
  attendance_status TEXT NOT NULL DEFAULT 'registered' CHECK (attendance_status IN ('registered', 'present', 'absent')),
  attended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_email ON event_participants(participant_email);
CREATE INDEX IF NOT EXISTS idx_event_participants_status ON event_participants(event_id, attendance_status);

ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_participants_select_authenticated" ON event_participants;
CREATE POLICY "event_participants_select_authenticated"
ON event_participants FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_participants_insert_authenticated" ON event_participants;
CREATE POLICY "event_participants_insert_authenticated"
ON event_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_participants_update_authenticated" ON event_participants;
CREATE POLICY "event_participants_update_authenticated"
ON event_participants FOR UPDATE
USING (auth.uid() IS NOT NULL);

