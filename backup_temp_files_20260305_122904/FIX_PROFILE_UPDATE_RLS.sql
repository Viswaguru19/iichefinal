-- Fix Profile Update RLS Policy
-- Issue: Users cannot update their own profiles due to RLS policy restrictions

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Recreate with proper permissions
-- Users can update their own basic profile fields
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Ensure users cannot change their own role/admin status
    AND (
      role = (SELECT role FROM profiles WHERE id = auth.uid())
      OR is_admin(auth.uid())
    )
    AND (
      is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
      OR is_admin(auth.uid())
    )
    AND (
      is_faculty = (SELECT is_faculty FROM profiles WHERE id = auth.uid())
      OR is_admin(auth.uid())
    )
  );

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Alternative simpler approach if above doesn't work:
-- Just allow users to update their own profiles without restrictions on role changes
-- (since the UI doesn't expose those fields anyway)

/*
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
*/
