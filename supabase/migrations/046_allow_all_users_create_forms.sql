-- Allow all authenticated users to create forms
-- This replaces the restrictive policy that only allowed heads/co-heads

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Committee heads can create forms" ON forms;

-- Create new policy allowing all authenticated users
CREATE POLICY "All authenticated users can create forms"
  ON forms FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
  );

-- Also ensure all users can update their own forms
DROP POLICY IF EXISTS "Form creators can update their forms" ON forms;

CREATE POLICY "Form creators and admins can update forms"
  ON forms FOR UPDATE
  USING (
    created_by = auth.uid()
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR is_admin(auth.uid())
  );

-- Ensure all users can view forms
DROP POLICY IF EXISTS "Anyone can view active forms" ON forms;

CREATE POLICY "All users can view forms"
  ON forms FOR SELECT
  USING (
    is_active = true
    OR created_by = auth.uid()
    OR is_admin(auth.uid())
  );
