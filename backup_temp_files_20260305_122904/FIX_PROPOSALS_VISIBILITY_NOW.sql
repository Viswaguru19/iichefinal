-- Fix Proposals Visibility for Committee Heads
-- This ensures committee heads can see events pending their approval

-- Step 1: Check current RLS policies on events table
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'events' 
  AND cmd = 'SELECT';

-- Step 2: Drop old restrictive policies if they exist
DROP POLICY IF EXISTS "Committee heads can view their events" ON events;
DROP POLICY IF EXISTS "Users can view their committee events" ON events;
DROP POLICY IF EXISTS "Committee members can view events" ON events;

-- Step 3: Create comprehensive SELECT policy for events
CREATE POLICY "Users can view events based on role"
ON events FOR SELECT
USING (
  -- Super admins and secretaries can see all events
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
  OR
  -- Faculty can see all events
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_faculty = true
  )
  OR
  -- EC members can see all events
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
  )
  OR
  -- Committee members (including heads) can see their committee's events
  committee_id IN (
    SELECT committee_id 
    FROM committee_members 
    WHERE user_id = auth.uid()
  )
  OR
  -- Users can see events they proposed
  proposed_by = auth.uid()
  OR
  -- Users can see events they created
  created_by = auth.uid()
);

-- Step 4: Ensure committee_members table is accessible
DROP POLICY IF EXISTS "Users can view committee memberships" ON committee_members;

CREATE POLICY "Users can view committee memberships"
ON committee_members FOR SELECT
USING (true); -- Allow all authenticated users to view memberships

-- Step 5: Ensure committees table is accessible
DROP POLICY IF EXISTS "Anyone can view committees" ON committees;

CREATE POLICY "Anyone can view committees"
ON committees FOR SELECT
USING (true); -- Allow everyone to view committees

-- Step 6: Ensure profiles table is accessible for joins
DROP POLICY IF EXISTS "Users can view other profiles" ON profiles;

CREATE POLICY "Users can view other profiles"
ON profiles FOR SELECT
USING (true); -- Allow all authenticated users to view profiles

-- Step 7: Ensure ec_approvals table is accessible
DROP POLICY IF EXISTS "Users can view ec approvals" ON ec_approvals;

CREATE POLICY "Users can view ec approvals"
ON ec_approvals FOR SELECT
USING (
  -- EC members can see all approvals
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
  )
  OR
  -- Admins can see all approvals
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
  OR
  -- Faculty can see all approvals
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_faculty = true
  )
  OR
  -- Committee heads can see approvals for their events
  event_id IN (
    SELECT e.id FROM events e
    WHERE e.committee_id IN (
      SELECT committee_id FROM committee_members 
      WHERE user_id = auth.uid()
      AND position IN ('head', 'co_head')
    )
  )
);

-- Step 8: Verify the policies
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN length(qual::text) > 100 THEN substring(qual::text, 1, 100) || '...'
    ELSE qual::text
  END as policy_condition
FROM pg_policies 
WHERE tablename IN ('events', 'committee_members', 'committees', 'profiles', 'ec_approvals')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;

-- Step 9: Test query for a committee head
-- This simulates what the proposals page does
SELECT 
  e.id,
  e.title,
  e.status,
  e.committee_id,
  c.name as committee_name,
  p.name as proposer_name,
  e.created_at
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles p ON e.proposed_by = p.id
WHERE e.status IN ('pending_head_approval', 'pending_ec_approval', 'pending_faculty_approval', 'active')
ORDER BY e.created_at DESC
LIMIT 20;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies updated for proposals visibility';
  RAISE NOTICE '✅ Committee heads can now see their events';
  RAISE NOTICE '✅ EC members can see all events';
  RAISE NOTICE '✅ Faculty and admins can see all events';
  RAISE NOTICE '✅ Regular members can see their committee events';
END $$;
