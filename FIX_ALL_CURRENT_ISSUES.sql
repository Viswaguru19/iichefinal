-- Fix all current issues: forms, meetings, notifications, events RLS

-- ============================================
-- 1. FIX FORMS AND FORM_FIELDS RLS
-- ============================================

-- Enable RLS on form_fields
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

-- Drop existing form_fields policies
DROP POLICY IF EXISTS "Form creators can insert fields" ON form_fields;
DROP POLICY IF EXISTS "Anyone can view form fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can update fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can delete fields" ON form_fields;

-- Allow form creators to add fields
CREATE POLICY "Form creators can insert fields"
  ON form_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow viewing fields
CREATE POLICY "Anyone can view form fields"
  ON form_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.active = true OR forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow updating fields
CREATE POLICY "Form creators can update fields"
  ON form_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Allow deleting fields
CREATE POLICY "Form creators can delete fields"
  ON form_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_fields.form_id 
      AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- ============================================
-- 2. FIX MEETINGS TABLE - ADD MISSING COLUMNS
-- ============================================

-- Add meeting_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'meetings' AND column_name = 'meeting_type') THEN
    ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'general';
  END IF;
END $$;

-- Add other potentially missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'meetings' AND column_name = 'location') THEN
    ALTER TABLE meetings ADD COLUMN location TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'meetings' AND column_name = 'agenda') THEN
    ALTER TABLE meetings ADD COLUMN agenda TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'meetings' AND column_name = 'notes') THEN
    ALTER TABLE meetings ADD COLUMN notes TEXT;
  END IF;
END $$;

-- ============================================
-- 3. FIX NOTIFICATIONS RLS
-- ============================================

-- Drop existing notification policies
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Allow users to view their own notifications
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow system/admins to create notifications
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- ============================================
-- 4. FIX EVENTS RLS - ALLOW VIEWING
-- ============================================

-- Drop existing events SELECT policy
DROP POLICY IF EXISTS "Users can view events" ON events;
DROP POLICY IF EXISTS "Anyone can view active events" ON events;
DROP POLICY IF EXISTS "Committee members can view their events" ON events;

-- Create comprehensive SELECT policy for events
CREATE POLICY "Users can view events"
  ON events FOR SELECT
  USING (
    -- Everyone can see active/approved events
    status IN ('active', 'approved', 'completed')
    OR
    -- Users can see events from their committee
    committee_id IN (
      SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
    )
    OR
    -- Event creator can see their own events
    created_by = auth.uid()
    OR
    -- EC members can see all events
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR
    -- Admins can see all events
    is_admin(auth.uid())
  );

-- ============================================
-- 5. FIX TASKS RLS - ALLOW VIEWING AND UPDATING
-- ============================================

-- Drop existing task policies
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "EC can update tasks" ON tasks;

-- Allow viewing tasks
CREATE POLICY "Users can view tasks"
  ON tasks FOR SELECT
  USING (
    -- Users can see tasks assigned to their committee
    assigned_to IN (
      SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
    )
    OR
    -- EC members can see all tasks
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR
    -- Admins can see all tasks
    is_admin(auth.uid())
  );

-- Allow EC to update tasks (for approval)
CREATE POLICY "EC can update tasks"
  ON tasks FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE executive_role IS NOT NULL
    )
    OR is_admin(auth.uid())
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if all policies are created
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE tablename IN ('forms', 'form_fields', 'meetings', 'notifications', 'events', 'tasks')
ORDER BY tablename, policyname;
