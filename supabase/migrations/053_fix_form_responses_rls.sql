-- Fix form_responses RLS to allow EC, faculty, and committee heads to view responses
-- The current policy only allows form creator and admins

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Form creator can view responses" ON form_responses;
DROP POLICY IF EXISTS "Form responses viewable by form creator and admins" ON form_responses;

-- Create a more permissive SELECT policy
CREATE POLICY "Form responses viewable by authorized users"
  ON form_responses FOR SELECT
  USING (
    -- Form creator can always view
    auth.uid() IN (SELECT created_by FROM forms WHERE id = form_responses.form_id)
    -- User can view their own response
    OR auth.uid() = user_id
    -- Admins can view all
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    -- Faculty can view all
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_faculty = true)
    -- EC members can view all
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND executive_role IS NOT NULL)
    -- Committee heads/co-heads can view all
    OR EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND position IN ('head', 'co_head'))
  );
