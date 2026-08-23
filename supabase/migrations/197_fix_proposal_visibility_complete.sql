-- ============================================
-- COMPLETE FIX FOR PROPOSAL VISIBILITY ISSUE
-- ============================================

-- Step 1: Check the current event proposal and who created it
SELECT 
  ep.id,
  ep.event_name,
  ep.committee_id,
  c.name as committee_name,
  ep.created_by,
  p.name as created_by_name,
  p.email as created_by_email,
  ep.status,
  ep.head_approved,
  ep.head_approved_at,
  ep.created_at
FROM event_proposals ep
LEFT JOIN committees c ON ep.committee_id = c.id
LEFT JOIN profiles p ON ep.created_by = p.id
ORDER BY ep.created_at DESC
LIMIT 5;

-- Step 2: Check committee memberships for the head
SELECT 
  cm.user_id,
  p.name,
  p.email,
  cm.committee_id,
  c.name as committee_name,
  cm.position,
  cm.joined_at
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name, cm.position;

-- Step 3: Fix RLS policies for event_proposals table
DROP POLICY IF EXISTS "Anyone can view proposals" ON event_proposals;
DROP POLICY IF EXISTS "Committee members can view proposals" ON event_proposals;
DROP POLICY IF EXISTS "Heads can view committee proposals" ON event_proposals;

-- Create comprehensive policy for viewing proposals
CREATE POLICY "Users can view proposals" ON event_proposals
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
  -- Committee heads and co-heads can see their committee's proposals
  EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.user_id = auth.uid()
    AND cm.committee_id = event_proposals.committee_id
    AND cm.position IN ('head', 'co_head')
  )
  OR
  -- Committee members can see their committee's proposals
  EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.user_id = auth.uid()
    AND cm.committee_id = event_proposals.committee_id
  )
  OR
  -- Creator can see their own proposals
  event_proposals.created_by = auth.uid()
);

-- Step 4: Verify the RLS policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'event_proposals'
AND cmd = 'SELECT';

-- Step 5: Test query - Check what proposals a specific user can see
-- Replace 'USER_EMAIL_HERE' with the head's email
DO $$
DECLARE
  test_user_id UUID;
  proposal_count INTEGER;
BEGIN
  -- Get user ID (replace email)
  SELECT id INTO test_user_id 
  FROM profiles 
  WHERE email = 'USER_EMAIL_HERE' 
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'User not found. Please replace USER_EMAIL_HERE with actual email.';
  ELSE
    -- Count proposals this user should see
    SELECT COUNT(*) INTO proposal_count
    FROM event_proposals ep
    WHERE 
      EXISTS (
        SELECT 1 FROM committee_members cm
        WHERE cm.user_id = test_user_id
        AND cm.committee_id = ep.committee_id
        AND cm.position IN ('head', 'co_head')
      );
    
    RAISE NOTICE 'User ID: %', test_user_id;
    RAISE NOTICE 'Proposals visible to this user: %', proposal_count;
  END IF;
END $$;

-- Step 6: Check if there are any duplicate committee memberships
SELECT 
  cm.user_id,
  p.name,
  p.email,
  COUNT(*) as membership_count,
  STRING_AGG(c.name, ', ') as committees
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
GROUP BY cm.user_id, p.name, p.email
HAVING COUNT(*) > 1
ORDER BY membership_count DESC;

-- Step 7: Show pending proposals that need head approval
SELECT 
  ep.id,
  ep.event_name,
  c.name as committee_name,
  ep.status,
  ep.head_approved,
  CASE 
    WHEN ep.head_approved = false THEN 'Waiting for head approval'
    WHEN ep.head_approved = true AND ep.status = 'pending_ec' THEN 'Waiting for EC approval'
    ELSE ep.status
  END as approval_status
FROM event_proposals ep
JOIN committees c ON ep.committee_id = c.id
WHERE ep.head_approved = false
ORDER BY ep.created_at DESC;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'RLS policies updated! Heads should now see proposals.' as status;
