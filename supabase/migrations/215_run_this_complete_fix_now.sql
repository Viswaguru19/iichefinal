-- ============================================
-- COMPLETE FIX FOR PROPOSALS AND FORMS
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: FIX PROPOSALS VISIBILITY
-- ============================================

-- Step 1: Fix events table RLS policies
DROP POLICY IF EXISTS "Users can view events based on role" ON events;
DROP POLICY IF EXISTS "Committee heads can view their events" ON events;
DROP POLICY IF EXISTS "Users can view their committee events" ON events;
DROP POLICY IF EXISTS "Committee members can view events" ON events;

CREATE POLICY "Users can view events based on role"
ON events FOR SELECT
USING (
  -- Super admins and secretaries can see all events
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
  OR
  -- Faculty can see all events
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_faculty = true
  )
  OR
  -- EC members can see all events
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
  )
  OR
  -- Committee members (including heads) can see their committee's events
  committee_id IN (
    SELECT committee_id 
    FROM committee_members 
    WHERE user_id = auth.uid()
  )
  OR
  -- Users can see events they proposed
  proposed_by = auth.uid()
  OR
  -- Users can see events they created
  created_by = auth.uid()
);

-- Step 2: Ensure related tables are accessible
DROP POLICY IF EXISTS "Users can view committee memberships" ON committee_members;
CREATE POLICY "Users can view committee memberships"
ON committee_members FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can view committees" ON committees;
CREATE POLICY "Anyone can view committees"
ON committees FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can view other profiles" ON profiles;
CREATE POLICY "Users can view other profiles"
ON profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can view ec approvals" ON ec_approvals;
CREATE POLICY "Users can view ec approvals"
ON ec_approvals FOR SELECT
USING (
  -- EC members can see all approvals
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
  )
  OR
  -- Admins can see all approvals
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
  OR
  -- Faculty can see all approvals
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_faculty = true
  )
  OR
  -- Committee heads can see approvals for their events
  event_id IN (
    SELECT e.id FROM events e
    WHERE e.committee_id IN (
      SELECT committee_id FROM committee_members 
      WHERE user_id = auth.uid()
      AND position IN ('head', 'co_head')
    )
  )
);

-- ============================================
-- PART 2: FIX FORMS SYSTEM
-- ============================================

-- Step 3: Add show_on_homepage column to forms table
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN DEFAULT FALSE;

-- Step 4: Forms table RLS policies
DROP POLICY IF EXISTS "Anyone can view active forms" ON forms;
DROP POLICY IF EXISTS "Authenticated users can create forms" ON forms;
DROP POLICY IF EXISTS "Form creators can update their forms" ON forms;
DROP POLICY IF EXISTS "Form creators and admins can update forms" ON forms;

CREATE POLICY "Anyone can view active forms"
ON forms FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can create forms"
ON forms FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Form creators and admins can update forms"
ON forms FOR UPDATE
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
);

-- Step 5: Form fields RLS policies
DROP POLICY IF EXISTS "Anyone can view form fields" ON form_fields;
DROP POLICY IF EXISTS "Authenticated users can create form fields" ON form_fields;

CREATE POLICY "Anyone can view form fields"
ON form_fields FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create form fields"
ON form_fields FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Step 6: Form responses RLS policies
DROP POLICY IF EXISTS "Users can view their own responses" ON form_responses;
DROP POLICY IF EXISTS "Form creators can view all responses" ON form_responses;
DROP POLICY IF EXISTS "Form creators and admins can view all responses" ON form_responses;
DROP POLICY IF EXISTS "Authenticated users can submit responses" ON form_responses;

CREATE POLICY "Users can view their own responses"
ON form_responses FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Form creators and admins can view all responses"
ON form_responses FOR SELECT
USING (
  form_id IN (
    SELECT id FROM forms WHERE created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
);

CREATE POLICY "Authenticated users can submit responses"
ON form_responses FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_forms_homepage 
ON forms(show_on_homepage, is_active) 
WHERE show_on_homepage = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_events_committee 
ON events(committee_id) 
WHERE committee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_status 
ON events(status);

CREATE INDEX IF NOT EXISTS idx_committee_members_user 
ON committee_members(user_id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check events visibility
SELECT 
  'Events Table' as check_name,
  COUNT(*) as total_events,
  SUM(CASE WHEN status = 'pending_head_approval' THEN 1 ELSE 0 END) as pending_head,
  SUM(CASE WHEN status = 'pending_ec_approval' THEN 1 ELSE 0 END) as pending_ec,
  SUM(CASE WHEN status = 'pending_faculty_approval' THEN 1 ELSE 0 END) as pending_faculty,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_events
FROM events;

-- Check forms setup
SELECT 
  'Forms Table' as check_name,
  COUNT(*) as total_forms,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_forms,
  SUM(CASE WHEN show_on_homepage THEN 1 ELSE 0 END) as homepage_forms
FROM forms;

-- Check committee memberships
SELECT 
  'Committee Memberships' as check_name,
  COUNT(*) as total_memberships,
  SUM(CASE WHEN position = 'head' THEN 1 ELSE 0 END) as heads,
  SUM(CASE WHEN position = 'co_head' THEN 1 ELSE 0 END) as co_heads
FROM committee_members;

-- Show RLS policies
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN length(qual::text) > 100 THEN substring(qual::text, 1, 100) || '...'
    ELSE qual::text
  END as policy_condition
FROM pg_policies 
WHERE tablename IN ('events', 'forms', 'form_fields', 'form_responses', 'committee_members', 'committees', 'profiles', 'ec_approvals')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPLETE FIX APPLIED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'PROPOSALS FIX:';
  RAISE NOTICE '✅ Events RLS policies updated';
  RAISE NOTICE '✅ Committee heads can see their events';
  RAISE NOTICE '✅ EC members can see all events';
  RAISE NOTICE '✅ Faculty and admins can see all events';
  RAISE NOTICE '';
  RAISE NOTICE 'FORMS FIX:';
  RAISE NOTICE '✅ Added show_on_homepage column';
  RAISE NOTICE '✅ Forms RLS policies updated';
  RAISE NOTICE '✅ Form responses accessible to creators';
  RAISE NOTICE '✅ Forms can be created without fields';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Restart your Next.js dev server';
  RAISE NOTICE '2. Test proposals page as committee head';
  RAISE NOTICE '3. Test creating a form';
  RAISE NOTICE '4. Check browser console for any errors';
  RAISE NOTICE '========================================';
END $$;
