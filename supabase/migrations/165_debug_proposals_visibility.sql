-- Debug Proposals Visibility Issue
-- Run this to understand why committee heads can't see pending proposals

-- Step 1: Check all events with pending_head_approval status
SELECT 
  e.id,
  e.title,
  e.status,
  e.committee_id,
  c.name as committee_name,
  e.proposed_by,
  p.name as proposer_name,
  e.created_at
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles p ON e.proposed_by = p.id
WHERE e.status = 'pending_head_approval'
ORDER BY e.created_at DESC;

-- Step 2: Check committee memberships for heads
SELECT 
  p.id as user_id,
  p.name as user_name,
  p.email,
  cm.position,
  c.id as committee_id,
  c.name as committee_name
FROM profiles p
JOIN committee_members cm ON p.id = cm.user_id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name, cm.position;

-- Step 3: Check RLS policies on events table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'events'
ORDER BY policyname;

-- Step 4: Test query as a specific committee head
-- Replace USER_ID with actual committee head's user ID
DO $$
DECLARE
  test_user_id UUID := 'REPLACE_WITH_USER_ID'; -- Replace this
  committee_ids UUID[];
BEGIN
  -- Get committee IDs for this user
  SELECT ARRAY_AGG(committee_id) INTO committee_ids
  FROM committee_members
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'User committees: %', committee_ids;
  
  -- Show what events they should see
  RAISE NOTICE 'Events this user should see:';
  FOR r IN 
    SELECT e.id, e.title, e.status, e.committee_id, c.name as committee_name
    FROM events e
    LEFT JOIN committees c ON e.committee_id = c.id
    WHERE e.committee_id = ANY(committee_ids)
    ORDER BY e.created_at DESC
  LOOP
    RAISE NOTICE '  - % (%) - Committee: %', r.title, r.status, r.committee_name;
  END LOOP;
END $$;

-- Step 5: Check if there are NULL committee_ids
SELECT 
  COUNT(*) as events_without_committee,
  STRING_AGG(title, ', ') as event_titles
FROM events
WHERE committee_id IS NULL
  AND status = 'pending_head_approval';

-- Step 6: Verify the events table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('id', 'committee_id', 'status', 'proposed_by', 'title')
ORDER BY ordinal_position;
