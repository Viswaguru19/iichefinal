-- Per-event participant groups (create first, then add participants under a group).

CREATE TABLE IF NOT EXISTS event_participant_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_event_participant_groups_event
  ON event_participant_groups(event_id, sort_order);

ALTER TABLE event_participant_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_participant_groups_select" ON event_participant_groups;
CREATE POLICY "event_participant_groups_select"
ON event_participant_groups FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_participant_groups_insert" ON event_participant_groups;
CREATE POLICY "event_participant_groups_insert"
ON event_participant_groups FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_participant_groups_update" ON event_participant_groups;
CREATE POLICY "event_participant_groups_update"
ON event_participant_groups FOR UPDATE
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_participant_groups_delete" ON event_participant_groups;
CREATE POLICY "event_participant_groups_delete"
ON event_participant_groups FOR DELETE
USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE event_participant_groups IS 'User-defined groups for an event (e.g. 1st Year, 2nd Year) before adding participants';
