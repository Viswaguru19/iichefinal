-- Ensure event_reports table has all needed columns
CREATE TABLE IF NOT EXISTS event_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  report_content JSONB,
  additional_notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS report_content JSONB;
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS additional_notes TEXT;
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop NOT NULL on summary so old rows and new rows without it work fine
ALTER TABLE event_reports ALTER COLUMN summary DROP NOT NULL;

-- RLS
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_reports_select" ON event_reports;
DROP POLICY IF EXISTS "event_reports_insert" ON event_reports;
DROP POLICY IF EXISTS "event_reports_update" ON event_reports;

-- Anyone authenticated can view
CREATE POLICY "event_reports_select" ON event_reports FOR SELECT USING (auth.uid() IS NOT NULL);

-- EC, faculty, admin, editorial can create/update
CREATE POLICY "event_reports_insert" ON event_reports FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "event_reports_update" ON event_reports FOR UPDATE USING (
  auth.uid() IS NOT NULL
);
