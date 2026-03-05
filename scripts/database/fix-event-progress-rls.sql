-- ============================================
-- FIX: Event Progress RLS Policies
-- ============================================
-- This fixes RLS policies to allow client-side queries
-- to access events in the Event Progress page
-- ============================================

-- Step 1: Drop existing restrictive policies
DROP POLICY IF EXISTS "Active events viewable by all" ON events;
DROP POLICY IF EXISTS "Events viewable by everyone" ON events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "public_read_events" ON events;
DROP POLICY IF EXISTS "authenticated_insert_events" ON events;
DROP POLICY IF EXISTS "authenticated_update_events" ON events;
DROP POLICY IF EXISTS "authenticated_delete_events" ON events;

-- Step 2: Create simple SELECT policy that works client-side
CREATE POLICY "public_read_events"
  ON events
  FOR SELECT
  USING (true);

-- Step 3: Create policies for other operations
CREATE POLICY "authenticated_insert_events"
  ON events
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_events"
  ON events
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_events"
  ON events
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Step 4: Verify policies were created
SELECT 
  '✅ RLS Policies Created' as status,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'events'
ORDER BY cmd, policyname;

-- Step 5: Test query (should return active events)
SELECT 
  '📋 Active Events' as section,
  id,
  title,
  status,
  date
FROM events
WHERE status = 'active'
ORDER BY date DESC;

-- Success message
SELECT '✅ Fix applied! Refresh Event Progress page to see events.' as message;
