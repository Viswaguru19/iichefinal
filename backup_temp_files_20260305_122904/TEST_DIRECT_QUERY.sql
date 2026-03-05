-- ============================================
-- TEST DIRECT QUERY - Can you see events?
-- ============================================

-- Disable RLS temporarily to test
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Now try to see events
SELECT 
  '🔓 RLS DISABLED - CAN YOU SEE NOW?' as section,
  id,
  title,
  status,
  date
FROM events
WHERE status = 'active';

-- Count them
SELECT 
  '📊 COUNT' as section,
  COUNT(*) as total_active_events
FROM events
WHERE status = 'active';

-- Re-enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Everyone can view active events" ON events;
DROP POLICY IF EXISTS "Active events viewable by all" ON events;
DROP POLICY IF EXISTS "Events viewable by everyone" ON events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;

-- Create the SIMPLEST possible policy
CREATE POLICY "allow_all_select"
  ON events FOR SELECT
  USING (true);

-- Test again
SELECT 
  '✅ NEW POLICY - CAN YOU SEE NOW?' as section,
  id,
  title,
  status,
  date
FROM events
WHERE status = 'active';

SELECT '🎉 If you see events above, refresh Event Progress page!' as message;
