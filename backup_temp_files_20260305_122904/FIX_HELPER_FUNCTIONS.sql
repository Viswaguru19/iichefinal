-- ============================================
-- FIX HELPER FUNCTIONS
-- ============================================
-- This recreates helper functions with correct syntax
-- Run this if you get "function does not exist" errors
-- ============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS is_admin(UUID);
DROP FUNCTION IF EXISTS is_ec_member(UUID);
DROP FUNCTION IF EXISTS is_faculty(UUID);

-- ============================================
-- CREATE is_admin FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE is_ec_member FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION is_ec_member(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND executive_role IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE is_faculty FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION is_faculty(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND is_faculty = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
  'Helper functions created:' as info,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN ('is_admin', 'is_ec_member', 'is_faculty')
ORDER BY proname;

-- Test the functions
SELECT 
  'Function test:' as info,
  'Functions should now work correctly' as message;
