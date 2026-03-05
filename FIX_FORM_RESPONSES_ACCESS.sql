-- ============================================
-- FIX FORM RESPONSES ACCESS CONTROL
-- Only portal users can view responses, not regular students
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can submit form responses" ON form_responses;
DROP POLICY IF EXISTS "Form creator can view responses" ON form_responses;
DROP POLICY IF EXISTS "Anyone can view form responses" ON form_responses;

-- Policy 1: Anyone can submit responses (students filling forms)
CREATE POLICY "Anyone can submit form responses" ON form_responses 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Portal users can view all responses
-- This includes: admins, committee members, EC members, faculty
CREATE POLICY "Portal users can view responses" ON form_responses 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        is_admin = true 
        OR is_faculty = true 
        OR executive_role IS NOT NULL
        OR id IN (SELECT user_id FROM committee_members)
      )
    )
  );

-- Policy 3: Form creators can view their form's responses
CREATE POLICY "Form creators can view responses" ON form_responses 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_responses.form_id 
      AND forms.created_by = auth.uid()
    )
  );

-- Policy 4: Admins can delete responses
CREATE POLICY "Admins can delete responses" ON form_responses 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'form_responses'
ORDER BY policyname;

SELECT '✅ Form responses access control updated!' as status;
SELECT 'Only portal users (admins, committee members, EC, faculty) can view responses' as note;
SELECT 'Regular students can only submit responses, not view them' as note2;
