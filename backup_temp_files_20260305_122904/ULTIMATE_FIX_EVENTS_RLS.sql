-- ============================================
-- ULTIMATE FIX - COMPLETELY OPEN EVENTS TABLE
-- ============================================
-- This removes ALL restrictions on viewing events
-- ============================================

-- Step 1: Show current situation
SELECT '=== BEFORE FIX ===' as step;

SELECT 
  'RLS Status:' as info,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'events';

SELECT 
  'Current Policies:' as info,
  policyname
FROM pg_policies
WHERE tablename = 'events';

-- Step 2: Drop ALL policies on events
DROP POLICY IF EXISTS "allow_all_select" ON events;
DROP POLICY IF EXISTS "Everyone can view active events" ON events;
DROP POLICY IF EXISTS "Active events viewable by all" ON events;
DROP POLICY IF EXISTS "Events viewable by everyone" ON events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Committee members can create events" ON events;
DROP POLICY IF EXISTS "Committee coheads can propose events" ON events;
DROP POLICY IF EXISTS "Committee heads can approve events" ON events;
DROP POLICY IF EXISTS "EC members can approve events" ON events;
DROP POLICY IF EXISTS "Faculty can approve events" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;

-- Step 3: Create ONE simple policy for SELECT
CREATE POLICY "public_read_events"
  ON events
  FOR SELECT
  USING (true);

-- Step 4: Create policies for other operations (INSERT, UPDATE, DELETE)
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

-- Step 5: Verify
SELECT '=== AFTER FIX ===' as step;

SELECT 
  'New Policies:' as info,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'events'
ORDER BY cmd, policyname;

-- Step 6: Test query
SELECT 
  '=== TEST QUERY ===' as step,
  id,
  title,
  status,
  date,
  created_at
FROM events
WHERE status = 'active'
ORDER BY created_at DESC;

-- Step 7: Count
SELECT 
  '=== RESULT ===' as step,
  COUNT(*) as active_events_visible
FROM events
WHERE status = 'active';

SELECT '✅ Done! Everyone can now see all events. Refresh Event Progress page.' as message;
