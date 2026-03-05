-- ============================================
-- FIX EVENTS RLS POLICY
-- ============================================
-- Simplify the policy to allow everyone to see active events
-- ============================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Active events viewable by all" ON events;
DROP POLICY IF EXISTS "Events viewable by everyone" ON events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;

-- Create a simple policy: Everyone can see active events
CREATE POLICY "Everyone can view active events"
  ON events FOR SELECT
  USING (
    status = 'active'
    OR status = 'completed'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.is_admin = true
        OR profiles.role = 'super_admin'
        OR profiles.executive_role IS NOT NULL
        OR profiles.is_faculty = true
        OR EXISTS (
          SELECT 1 FROM committee_members
          WHERE committee_members.user_id = auth.uid()
          AND committee_members.committee_id = events.committee_id
        )
      )
    )
  );

-- Verify the policy was created
SELECT 
  '✅ POLICY CREATED' as section,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'events'
  AND policyname = 'Everyone can view active events';

-- Test if you can now see active events
SELECT 
  '🎉 TEST QUERY' as section,
  COUNT(*) as active_events_count
FROM events
WHERE status = 'active';

-- Show the events
SELECT 
  '📋 ACTIVE EVENTS' as section,
  id,
  title,
  status,
  date
FROM events
WHERE status = 'active'
ORDER BY date DESC;

SELECT '✅ Done! Refresh Event Progress page now.' as message;
