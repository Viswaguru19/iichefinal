-- ============================================
-- CHECK IF HELPER FUNCTIONS EXIST
-- ============================================

-- Check if helper functions exist
SELECT 
  '🔍 HELPER FUNCTIONS' as section,
  routine_name as function_name,
  routine_type as type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_ec_member', 'is_faculty', 'is_admin', 'is_committee_member')
ORDER BY routine_name;

-- Test the functions with current user
SELECT 
  '🧪 FUNCTION TESTS' as section,
  is_ec_member(auth.uid()) as is_ec,
  is_faculty(auth.uid()) as is_fac,
  is_admin(auth.uid()) as is_adm
FROM (SELECT 1) as dummy;

-- Show current user details
SELECT 
  '👤 CURRENT USER' as section,
  id,
  name,
  email,
  role,
  executive_role,
  is_admin,
  is_faculty
FROM profiles
WHERE id = auth.uid();
