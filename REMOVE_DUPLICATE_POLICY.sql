-- Remove duplicate/conflicting event policy

DROP POLICY IF EXISTS "public_read_events" ON events;

-- Verify only one SELECT policy remains
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'events' AND cmd = 'SELECT';
