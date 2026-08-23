-- Migration: 065_meeting_attendance
-- Create meeting_attendance table for tracking attendance per meeting

-- ============================================
-- 1. Create meeting_attendance table
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent')),
  marked_by UUID REFERENCES profiles(id),
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

-- ============================================
-- 2. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting ON meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_user ON meeting_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_status ON meeting_attendance(meeting_id, status);

-- ============================================
-- 3. RLS
-- ============================================
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;

-- Participants can view their own record; managers (EC/faculty/admin) can view all
CREATE POLICY "Participants can view attendance"
  ON meeting_attendance FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.executive_role IS NOT NULL OR profiles.is_faculty = true OR profiles.is_admin = true)
    )
  );

-- Only EC/Faculty/Admin can insert/update attendance
CREATE POLICY "Managers can manage attendance"
  ON meeting_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.executive_role IS NOT NULL OR profiles.is_faculty = true OR profiles.is_admin = true)
    )
  );
