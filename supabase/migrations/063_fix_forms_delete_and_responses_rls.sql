-- ============================================================
-- FIX FORMS: Delete + Response visibility
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================

-- STEP 1: Drop ALL policies on form_responses
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'form_responses' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON form_responses', pol.policyname);
  END LOOP;
END $$;

-- STEP 2: Drop ALL policies on forms
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'forms' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON forms', pol.policyname);
  END LOOP;
END $$;

-- STEP 3: Ensure RLS is enabled
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create clean forms policies
CREATE POLICY "forms_select" ON forms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "forms_insert" ON forms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "forms_update" ON forms FOR UPDATE USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_faculty = true OR executive_role IS NOT NULL))
);
CREATE POLICY "forms_delete" ON forms FOR DELETE USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_faculty = true OR executive_role IS NOT NULL))
);

-- STEP 5: Create clean form_responses policies
-- SELECT: any authenticated user can read (UI handles access control)
CREATE POLICY "form_responses_select" ON form_responses FOR SELECT USING (auth.uid() IS NOT NULL);
-- INSERT: any authenticated user can submit
CREATE POLICY "form_responses_insert" ON form_responses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- DELETE: form creator or admin
CREATE POLICY "form_responses_delete" ON form_responses FOR DELETE USING (
  user_id = auth.uid() OR auth.uid() IN (SELECT created_by FROM forms WHERE id = form_responses.form_id)
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_faculty = true OR executive_role IS NOT NULL))
);
