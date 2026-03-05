-- ============================================
-- FIX: RLS Policies Blocking Alumni Head
-- ============================================

-- STEP 1: Verify the event and head match
SELECT 
    'Event Info' as type,
    e.id,
    e.title,
    e.committee_id,
    c.name as committee_name,
    e.status
FROM events e
JOIN committees c ON e.committee_id = c.id
WHERE c.name ILIKE '%alumni%'
  AND e.status = 'pending_head_approval'

UNION ALL

SELECT 
    'Head Info' as type,
    p.id,
    p.name,
    cm.committee_id,
    c.name as committee_name,
    cm.position
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE c.name ILIKE '%alumni%'
  AND cm.position IN ('head', 'co_head');

-- If committee_id matches, the issue is RLS policies

-- STEP 2: Check current RLS policies on events table
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'events'
ORDER BY cmd, policyname;

-- STEP 3: FIX - Drop and recreate RLS policies
-- This ensures committee heads can see their committee's events

-- Drop old policies
DROP POLICY IF EXISTS "Users can view events based on role" ON events;
DROP POLICY IF EXISTS "Users can view events from their committees" ON events;
DROP POLICY IF EXISTS "Committee heads can view their committee events" ON events;
DROP POLICY IF EXISTS "EC members can view all events" ON events;
DROP POLICY IF EXISTS "Admins can view all events" ON events;
DROP POLICY IF EXISTS "Public can view approved events" ON events;
DROP POLICY IF EXISTS "Users can view all approved events" ON events;

-- Create new comprehensive SELECT policy
CREATE POLICY "Users can view events based on role"
ON events FOR SELECT
USING (
  -- Public can see approved events
  status = 'approved'
  OR
  -- Authenticated users
  (
    auth.uid() IS NOT NULL
    AND (
      -- User is in the committee (ANY position)
      committee_id IN (
        SELECT committee_id 
        FROM committee_members 
        WHERE user_id = auth.uid()
      )
      OR
      -- User is EC member
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

-- STEP 4: Ensure UPDATE policy allows heads to approve
DROP POLICY IF EXISTS "Authorized users can update events" ON events;
DROP POLICY IF EXISTS "Committee heads can update their events" ON events;
DROP POLICY IF EXISTS "EC can update events" ON events;

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

-- STEP 5: Verify policies are created
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN '✅ Can view'
        WHEN cmd = 'UPDATE' THEN '✅ Can update'
    END as permission
FROM pg_policies
WHERE tablename = 'events'
  AND cmd IN ('SELECT', 'UPDATE')
ORDER BY cmd;

-- STEP 6: Test if head can now see the event
-- This simulates what the head should see
SELECT 
    e.id,
    e.title,
    e.status,
    c.name as committee_name,
    proposer.name as proposed_by,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM committee_members cm
            WHERE cm.committee_id = e.committee_id
            AND cm.position IN ('head', 'co_head')
        ) THEN '✅ Head can approve'
        ELSE '❌ No head assigned'
    END as approval_status
FROM events e
JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE e.status = 'pending_head_approval'
  AND c.name ILIKE '%alumni%';

-- STEP 7: After running this, have the user:
-- 1. Log out completely
-- 2. Clear browser cache (or use incognito)
-- 3. Log back in
-- 4. Go to /dashboard/proposals
-- 5. Should now see the event!
