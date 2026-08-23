-- Simple Fix for Profile Update RLS
-- Run this in Supabase SQL Editor

-- Drop and recreate the user profile update policy with simpler logic
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
AND policyname = 'Users can update own profile';
