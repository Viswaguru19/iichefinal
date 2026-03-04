-- ============================================
-- FIX: Committee heads cannot see proposals
-- ============================================

-- This script ensures committee heads can see and approve
-- proposals from their committees

-- 1. Check current RLS policies on events table
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'events';

-- 2. Drop and recreate RLS policies for events table
-- to ensure committee heads can see their committee's events

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view events from their committees" ON events;
DROP POLICY IF EXISTS "Committee heads can view their committee events" ON events;
DROP POLICY IF EXISTS "EC members can view all events" ON events;
DROP POLICY IF EXISTS "Admins can view all events" ON events;
DROP POLICY IF EXISTS "Public can view approved events" ON events;
DROP POLICY IF EXISTS "Users can view all approved events" ON events;

-- Create comprehensive SELECT policy
CREATE POLICY "Users can view events based on role"
ON events FOR SELECT
USING (
  -- Public can see approved events
  status = 'approved'
  OR
  -- Authenticated users can see events from their committees
  (
    auth.uid() IS NOT NULL
    AND (
      -- User is in the committee
      committee_id IN (
        SELECT committee_id 
        FROM committee_members 
        WHERE user_id = auth.uid()
      )
      OR
      -- User is EC member (can see all events)
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND executive_role IS NOT NULL
      )
      OR
      -- User is admin
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (is_admin = true OR role IN ('super_admin', 'secretary'))
      )
      OR
      -- User is faculty
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND is_faculty = true
      )
      OR
      -- User proposed the event
      proposed_by = auth.uid()
    )
  )
);

-- 3. Ensure INSERT policy allows committee heads/co-heads to create events
DROP POLICY IF EXISTS "Committee heads can create events" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;

CREATE POLICY "Committee heads and co-heads can create events"
ON events FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- User is head or co-head of the committee
    EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = auth.uid()
      AND committee_id = events.committee_id
      AND position IN ('head', 'co_head')
    )
    OR
    -- User is admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('super_admin', 'secretary'))
    )
  )
);

-- 4. Ensure UPDATE policy allows heads and EC to approve
DROP POLICY IF EXISTS "Committee heads can update their events" ON events;
DROP POLICY IF EXISTS "EC can update events" ON events;
DROP POLICY IF EXISTS "Users can update events" ON events;

CREATE POLICY "Authorized users can update events"
ON events FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Committee head/co-head can update their committee's events
    EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = auth.uid()
      AND committee_id = events.committee_id
      AND position IN ('head', 'co_head')
    )
    OR
    -- EC members can update any event
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND executive_role IS NOT NULL
    )
    OR
    -- Admin can update any event
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('super_admin', 'secretary'))
    )
    OR
    -- Faculty can update any event
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_faculty = true
    )
  )
);

-- 5. Verify the policies are created
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN '✅ Can view'
        WHEN cmd = 'INSERT' THEN '✅ Can create'
        WHEN cmd = 'UPDATE' THEN '✅ Can update'
        WHEN cmd = 'DELETE' THEN '✅ Can delete'
    END as permission
FROM pg_policies
WHERE tablename = 'events'
ORDER BY cmd, policyname;

-- 6. Test query: What a committee head should see
-- Replace USER_ID with the committee head's user ID
SELECT 
    e.id,
    e.title,
    e.status,
    e.committee_id,
    c.name as committee_name,
    proposer.name as proposed_by
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE 
    e.status = 'pending_head_approval'
    AND e.committee_id IN (
        SELECT committee_id 
        FROM committee_members 
        WHERE user_id = 'USER_ID_HERE'
        AND position IN ('head', 'co_head')
    )
ORDER BY e.created_at DESC;
