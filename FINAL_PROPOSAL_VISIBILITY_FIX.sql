-- ============================================
-- FINAL FIX: Proposal Visibility for Committee Heads
-- ============================================
-- This script ensures committee heads can see their committee's proposals

-- Step 1: Check current situation
SELECT 
  '=== CURRENT EVENTS ===' as section,
  e.id,
  e.title,
  e.committee_id,
  c.name as committee_name,
  e.proposed_by,
  p.name as proposer_name,
  e.status,
  e.created_at
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles p ON e.proposed_by = p.id
ORDER BY e.created_at DESC
LIMIT 5;

-- Step 2: Check committee heads
SELECT 
  '=== COMMITTEE HEADS ===' as section,
  cm.user_id,
  p.name as head_name,
  p.email,
  cm.committee_id,
  c.name as committee_name,
  cm.position
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name;

-- Step 3: Fix RLS policy on events table
DROP POLICY IF EXISTS "Users can view events based on role" ON events;
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Committee members can view events" ON events;
DROP POLICY IF EXISTS "Users can view events" ON events;

-- Create the correct policy
CREATE POLICY "Users can view events" ON events
FOR SELECT
USING (
  -- Super admin
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'super_admin'
  )
  OR
  -- Executive members
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.executive_role IS NOT NULL
  )
  OR
  -- Faculty
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_faculty = true
  )
  OR
  -- Committee members (including heads and co-heads)
  EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.user_id = auth.uid()
    AND cm.committee_id = events.committee_id
  )
  OR
  -- Creator
  events.proposed_by = auth.uid()
);

-- Step 4: Verify the policy
SELECT 
  '=== RLS POLICY VERIFICATION ===' as section,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'events'
AND cmd = 'SELECT';

-- Step 5: Test query - Simulate what the proposals page does
-- Replace 'HEAD_EMAIL_HERE' with the actual head's email
DO $$
DECLARE
  test_user_id UUID;
  test_committee_ids UUID[];
  event_count INTEGER;
BEGIN
  -- Get user ID
  SELECT id INTO test_user_id 
  FROM profiles 
  WHERE email = 'HEAD_EMAIL_HERE'  -- REPLACE THIS
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE '❌ User not found. Replace HEAD_EMAIL_HERE with actual email.';
  ELSE
    -- Get committee IDs for this user
    SELECT ARRAY_AGG(committee_id) INTO test_committee_ids
    FROM committee_members
    WHERE user_id = test_user_id;
    
    RAISE NOTICE '✓ User ID: %', test_user_id;
    RAISE NOTICE '✓ Committee IDs: %', test_committee_ids;
    
    -- Count events this user should see
    SELECT COUNT(*) INTO event_count
    FROM events e
    WHERE e.committee_id = ANY(test_committee_ids);
    
    RAISE NOTICE '✓ Events visible to this user: %', event_count;
    
    -- Show the events
    RAISE NOTICE '=== EVENTS THIS HEAD SHOULD SEE ===';
    FOR event_record IN 
      SELECT e.title, e.status, c.name as committee_name
      FROM events e
      JOIN committees c ON e.committee_id = c.id
      WHERE e.committee_id = ANY(test_committee_ids)
      ORDER BY e.created_at DESC
    LOOP
      RAISE NOTICE '  - % (%) - %', event_record.title, event_record.committee_name, event_record.status;
    END LOOP;
  END IF;
END $$;

-- Step 6: Check for duplicate committee memberships
SELECT 
  '=== DUPLICATE MEMBERSHIPS CHECK ===' as section,
  cm.user_id,
  p.name,
  p.email,
  COUNT(*) as membership_count,
  STRING_AGG(c.name, ', ') as committees
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
GROUP BY cm.user_id, p.name, p.email
HAVING COUNT(*) > 1;

-- Step 7: Show which proposals need head approval
SELECT 
  '=== PROPOSALS PENDING HEAD APPROVAL ===' as section,
  e.id,
  e.title,
  c.name as committee_name,
  e.status,
  p.name as proposed_by,
  e.created_at
FROM events e
JOIN committees c ON e.committee_id = c.id
JOIN profiles p ON e.proposed_by = p.id
WHERE e.status = 'pending_head_approval'
ORDER BY e.created_at DESC;

-- ============================================
-- INSTRUCTIONS
-- ============================================
SELECT '
✅ RLS POLICY UPDATED!

NEXT STEPS:
1. Replace HEAD_EMAIL_HERE in Step 5 with the actual head email
2. Run this script again to see the test results
3. Have the head:
   - Log out completely
   - Clear browser cache (Ctrl+Shift+Delete)
   - Log back in
   - Go to Dashboard → Proposals
   
4. The head should now see their committee proposals

If still not visible:
- Check browser console (F12) for errors
- Verify the head is in the correct committee
- Verify the event committee_id matches the head committee_id
' as instructions;
