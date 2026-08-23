-- ============================================
-- CHECK RLS POLICIES ON EVENTS TABLE
-- ============================================

-- Check if RLS is enabled
SELECT 
  '🔒 RLS STATUS' as section,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'events';

-- Show all policies on events table
SELECT 
  '📋 CURRENT POLICIES' as section,
  policyname as policy_name,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'events'
ORDER BY policyname;

-- Test if current user can see active events
SELECT 
  '👁️ CAN YOU SEE ACTIVE EVENTS?' as section,
  COUNT(*) as active_events_visible
FROM events
WHERE status = 'active';

-- Show the actual event with all details
SELECT 
  '📋 THE ACTIVE EVENT' as section,
  id,
  title,
  status,
  committee_id,
  proposed_by,
  head_approved_by,
  date,
  created_at
FROM events
WHERE status = 'active';

-- Check current user's profile
SELECT 
  '👤 YOUR USER INFO' as section,
  id,
  name,
  email,
  role,
  executive_role,
  is_admin,
  (SELECT COUNT(*) FROM committee_members WHERE user_id = profiles.id) as committee_count
FROM profiles
WHERE id = auth.uid();
