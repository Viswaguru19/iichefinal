-- Drop ALL triggers on events
DROP TRIGGER IF EXISTS trigger_notify_heads_on_proposal ON events;
DROP FUNCTION IF EXISTS notify_heads_on_proposal() CASCADE;

-- Drop ALL policies on events (they reference the enum type)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'events'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON events'; END LOOP;
END $$;

-- Drop ALL policies on task_assignments (some reference events.status)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'task_assignments'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON task_assignments'; END LOOP;
END $$;

-- Change events.status from enum to TEXT
ALTER TABLE events ALTER COLUMN status DROP DEFAULT;
ALTER TABLE events ALTER COLUMN status TYPE TEXT USING status::TEXT;
ALTER TABLE events ALTER COLUMN status SET DEFAULT 'draft';

-- Recreate simple open policies on events
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Authenticated can create events" ON events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update events" ON events FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Recreate simple open policies on task_assignments
CREATE POLICY "Anyone can view task_assignments" ON task_assignments FOR SELECT USING (true);
CREATE POLICY "Authenticated can create task_assignments" ON task_assignments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update task_assignments" ON task_assignments FOR UPDATE USING (auth.uid() IS NOT NULL);
