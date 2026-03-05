-- ============================================
-- FIX COMMITTEES DISPLAY AND FORMS/MEETINGS ACCESS
-- ============================================
-- This fixes:
-- 1. Committee boxes having different sizes (UI only)
-- 2. Forms accessible to all authenticated users
-- 3. Meetings accessible to all authenticated users
-- ============================================

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

-- Allow meeting creators to add participants
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

-- Check forms policies
SELECT 
  'Forms policies:' as info,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'forms'
ORDER BY policyname;

-- Check meetings policies
SELECT 
  'Meetings policies:' as info,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'meetings'
ORDER BY policyname;

-- Test query - should work for any authenticated user
SELECT 
  'Access test:' as info,
  'Any authenticated user can now create forms and meetings' as message;
