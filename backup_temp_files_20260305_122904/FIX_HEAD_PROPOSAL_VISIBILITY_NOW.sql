-- ============================================
-- FIX: Committee Heads Cannot See Proposals
-- ============================================
-- This script fixes RLS policies so heads can see their committee's proposals

-- Step 1: Drop existing RLS policies on events table
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Committee members can view events" ON events;
DROP POLICY IF EXISTS "Users can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;

-- Step 2: Create comprehensive RLS policy for viewing events
CREATE POLICY "Users can view events based on role" ON events
FOR SELECT
USING (
  -- Super admin can see all
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'super_admin'
  )
  OR
  -- Executive members can see all
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.executive_role IS NOT NULL
  )
  OR
  -- Faculty can see all
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_faculty = true
  )
  OR
  -- Committee heads and co-heads can see their committee's events
  EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.user_id = auth.uid()
    AND cm.committee_id = events.committee_id
    AND cm.position IN ('head', 'co_head')
  )
  OR
  -- Committee members can see their committee's events
  EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.user_id = auth.uid()
    AND cm.committee_id = events.committee_id
  )
  OR
  -- Creator can see their own events
  events.proposed_by = auth.uid()
);

-- Step 3: Verify the policy was created
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'events'
AND cmd = 'SELECT';

-- Step 4: Check current events and their committee
SELECT 
  e.id,
  e.title as event_name,
  e.committee_id,
  c.name as committee_name,
  e.proposed_by,
  p.name as proposed_by_name,
  p.email as proposed_by_email,
  e.status,
  e.head_approved,
  e.created_at
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles p ON e.proposed_by = p.id
ORDER BY e.created_at DESC
LIMIT 10;

-- Step 5: Check committee heads and their committees
SELECT 
  cm.user_id,
  p.name as head_name,
  p.email as head_email,
  cm.committee_id,
  c.name as committee_name,
  cm.position
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name, cm.position;

-- Step 6: Test - Show which events each head should see
-- This shows the mapping between heads and events they should see
SELECT 
  p.name as head_name,
  p.email as head_email,
  c.name as committee_name,
  COUNT(e.id) as events_count,
  STRING_AGG(e.title, ', ') as event_titles
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
LEFT JOIN events e ON e.committee_id = cm.committee_id
WHERE cm.position IN ('head', 'co_head')
GROUP BY p.name, p.email, c.name
ORDER BY c.name;

-- Step 7: Check for any events pending head approval
SELECT 
  e.id,
  e.title,
  c.name as committee_name,
  e.status,
  e.head_approved,
  CASE 
    WHEN e.head_approved = false THEN 'Waiting for head approval'
    WHEN e.head_approved = true AND e.status = 'pending_ec' THEN 'Waiting for EC approval'
    WHEN e.status = 'approved' THEN 'Approved - In progress'
    ELSE e.status
  END as current_status
FROM events e
JOIN committees c ON e.committee_id = c.id
WHERE e.head_approved = false OR e.status = 'pending_head'
ORDER BY e.created_at DESC;

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- After running this script:
-- 1. Have the committee head log out and log back in
-- 2. Clear browser cache (Ctrl+Shift+Delete)
-- 3. Go to Dashboard → Proposals
-- 4. The head should now see their committee's pending events
-- 
-- If still not visible, check the browser console (F12) for errors
-- ============================================

SELECT '✅ RLS policies updated! Committee heads should now see proposals.' as status;
