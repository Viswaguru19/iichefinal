-- Fix "Event not found" issue by making events RLS more permissive

-- Drop existing events SELECT policy
DROP POLICY IF EXISTS "Users can view events" ON events;
DROP POLICY IF EXISTS "Anyone can view active events" ON events;
DROP POLICY IF EXISTS "Committee members can view their events" ON events;
DROP POLICY IF EXISTS "All users can view events" ON events;

-- Create very permissive SELECT policy for events
-- This allows users to see events in multiple scenarios
CREATE POLICY "All users can view events"
  ON events FOR SELECT
  USING (
    -- Allow viewing if:
    -- 1. Event is in any visible status
    status IN ('active', 'approved', 'completed', 'pending_head_approval', 'pending_ec_approval', 'pending_faculty_approval', 'in_progress')
    OR
    -- 2. User is in the same committee as the event
    committee_id IN (
      SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
    )
    OR
    -- 3. User created the event
    created_by = auth.uid()
    OR
    -- 4. User is an EC member (can see all events)
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR
    -- 5. User is admin (can see all events)
    is_admin(auth.uid())
    OR
    -- 6. User is faculty (can see all events)
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_faculty = true
    )
  );

-- Verify the policy was created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'events' AND cmd = 'SELECT';
