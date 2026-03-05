-- ============================================
-- COMPLETE ACCESS FIX - FORMS AND MEETINGS
-- ============================================
-- This creates missing tables and fixes access policies
-- ============================================

-- ============================================
-- ENSURE MEETING_PARTICIPANTS TABLE EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  attended BOOLEAN DEFAULT FALSE,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);

-- ============================================
-- FIX FORMS ACCESS - ALLOW ALL USERS
-- ============================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Committee heads can create forms" ON forms;
DROP POLICY IF EXISTS "All authenticated users can create forms" ON forms;

-- Create new policy allowing all authenticated users
CREATE POLICY "All authenticated users can create forms"
  ON forms FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Allow users to update their own forms or admins
DROP POLICY IF EXISTS "Form creators can update" ON forms;
DROP POLICY IF EXISTS "Form creators can update their forms" ON forms;
CREATE POLICY "Form creators can update their forms"
  ON forms FOR UPDATE
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Allow users to delete their own forms or admins
DROP POLICY IF EXISTS "Form creators can delete" ON forms;
DROP POLICY IF EXISTS "Form creators can delete their forms" ON forms;
CREATE POLICY "Form creators can delete their forms"
  ON forms FOR DELETE
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- ============================================
-- FIX MEETINGS ACCESS - ALLOW ALL USERS
-- ============================================

-- Ensure meetings table has proper RLS enabled
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Drop old restrictive policies if they exist
DROP POLICY IF EXISTS "Committee heads can create meetings" ON meetings;
DROP POLICY IF EXISTS "Anyone can create meetings" ON meetings;
DROP POLICY IF EXISTS "All authenticated users can create meetings" ON meetings;

-- Create new policy allowing all authenticated users to create meetings
CREATE POLICY "All authenticated users can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Allow everyone to view meetings
DROP POLICY IF EXISTS "Anyone can view meetings" ON meetings;
DROP POLICY IF EXISTS "Everyone can view meetings" ON meetings;
CREATE POLICY "Everyone can view meetings"
  ON meetings FOR SELECT
  USING (true);

-- Allow meeting creators to update their meetings or admins
DROP POLICY IF EXISTS "Meeting creators can update" ON meetings;
DROP POLICY IF EXISTS "Meeting creators can update their meetings" ON meetings;
CREATE POLICY "Meeting creators can update their meetings"
  ON meetings FOR UPDATE
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Allow meeting creators to delete their meetings or admins
DROP POLICY IF EXISTS "Meeting creators can delete" ON meetings;
DROP POLICY IF EXISTS "Meeting creators can delete their meetings" ON meetings;
CREATE POLICY "Meeting creators can delete their meetings"
  ON meetings FOR DELETE
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- ============================================
-- FIX MEETING PARTICIPANTS ACCESS
-- ============================================

-- Ensure meeting_participants has proper RLS
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view participants
DROP POLICY IF EXISTS "Anyone can view participants" ON meeting_participants;
DROP POLICY IF EXISTS "Everyone can view meeting participants" ON meeting_participants;
CREATE POLICY "Everyone can view meeting participants"
  ON meeting_participants FOR SELECT
  USING (true);

-- Allow meeting creators to manage participants
DROP POLICY IF EXISTS "Meeting creators can add participants" ON meeting_participants;
DROP POLICY IF EXISTS "Meeting creators can manage participants" ON meeting_participants;
CREATE POLICY "Meeting creators can manage participants"
  ON meeting_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_participants.meeting_id 
      AND meetings.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if meeting_participants table exists
SELECT 
  'Meeting participants table:' as info,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'meeting_participants'
ORDER BY ordinal_position;

-- Check forms policies
SELECT 
  'Forms policies:' as info,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'forms'
ORDER BY policyname;

-- Check meetings policies
SELECT 
  'Meetings policies:' as info,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'meetings'
ORDER BY policyname;

-- Check meeting_participants policies
SELECT 
  'Meeting participants policies:' as info,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'meeting_participants'
ORDER BY policyname;

-- Success message
SELECT 
  'Setup complete!' as info,
  'All users can now create forms and meetings' as message;
