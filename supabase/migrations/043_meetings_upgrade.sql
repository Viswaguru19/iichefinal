-- Migration: 043_meetings_upgrade
-- Upgrade meetings system: new columns, meeting_rooms table, participant extensions, indexes, RLS

-- ============================================
-- 1. Add new columns to meetings table
-- ============================================
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS venue_details TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS room_id TEXT UNIQUE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS audience_type TEXT DEFAULT 'all_members';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- ============================================
-- 1b. Add member_type column to profiles for audience targeting (e.g. alumni)
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'regular';

-- ============================================
-- 2. Add 'internal_portal' to meeting_platform enum (if enum exists)
-- ============================================
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_platform') THEN
    ALTER TYPE meeting_platform ADD VALUE IF NOT EXISTS 'internal_portal';
  END IF;
END $body$;

-- ============================================
-- 3. Create meeting_rooms table
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE UNIQUE,
  room_id TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  max_participants INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Add new columns to meeting_participants
-- ============================================
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS rsvp_status TEXT DEFAULT 'pending';
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- ============================================
-- 5. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_meetings_room_id ON meetings(room_id);
CREATE INDEX IF NOT EXISTS idx_meetings_audience_type ON meetings(audience_type);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_room_id ON meeting_rooms(room_id);

-- ============================================
-- 6. RLS for meeting_rooms
-- ============================================
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view meeting rooms"
  ON meeting_rooms FOR SELECT
  USING (true);

CREATE POLICY "Meeting creator can manage rooms"
  ON meeting_rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_rooms.meeting_id
      AND meetings.created_by = auth.uid()
    )
  );
