-- Meeting minutes table
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  header JSONB,
  meeting_date TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id)
);

-- Add columns if table already exists
ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS header JSONB;
ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Drop NOT NULL on any existing columns that might block inserts
DO $$ BEGIN
  ALTER TABLE meeting_minutes ALTER COLUMN file_url DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- RLS
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_minutes_select" ON meeting_minutes;
DROP POLICY IF EXISTS "meeting_minutes_insert" ON meeting_minutes;
DROP POLICY IF EXISTS "meeting_minutes_update" ON meeting_minutes;

CREATE POLICY "meeting_minutes_select" ON meeting_minutes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "meeting_minutes_insert" ON meeting_minutes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "meeting_minutes_update" ON meeting_minutes FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting ON meeting_minutes(meeting_id);
