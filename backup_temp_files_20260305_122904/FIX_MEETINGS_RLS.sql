-- Fix Meetings RLS Policy
-- Allow all authenticated users to create meetings (not just heads/EC)

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Committee heads can create meetings" ON meetings;

-- Create a more permissive policy
-- Option 1: Allow all authenticated users to create meetings
CREATE POLICY "Authenticated users can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

-- If you want to keep it restricted to committee members, heads, EC, and admins:
/*
DROP POLICY IF EXISTS "Authenticated users can create meetings" ON meetings;

CREATE POLICY "Committee members can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members
    )
    OR is_ec_member(auth.uid())
    OR is_admin(auth.uid())
  );
*/

-- Verify the policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'meetings'
AND cmd = 'INSERT';
