-- Complete Forms System Fix
-- Adds homepage visibility, proper RLS, and response viewing

-- Step 1: Add show_on_homepage column to forms table
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN DEFAULT FALSE;

-- Step 2: Ensure all necessary RLS policies exist

-- Forms table policies
DROP POLICY IF EXISTS "Anyone can view active forms" ON forms;
DROP POLICY IF EXISTS "Authenticated users can create forms" ON forms;
DROP POLICY IF EXISTS "Form creators can update their forms" ON forms;

CREATE POLICY "Anyone can view active forms"
ON forms FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can create forms"
ON forms FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Form creators and admins can update forms"
ON forms FOR UPDATE
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
);

-- Form fields policies
DROP POLICY IF EXISTS "Anyone can view form fields" ON form_fields;
DROP POLICY IF EXISTS "Authenticated users can create form fields" ON form_fields;

CREATE POLICY "Anyone can view form fields"
ON form_fields FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create form fields"
ON form_fields FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Form responses policies
DROP POLICY IF EXISTS "Users can view their own responses" ON form_responses;
DROP POLICY IF EXISTS "Form creators can view all responses" ON form_responses;
DROP POLICY IF EXISTS "Authenticated users can submit responses" ON form_responses;

CREATE POLICY "Users can view their own responses"
ON form_responses FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Form creators and admins can view all responses"
ON form_responses FOR SELECT
USING (
  form_id IN (
    SELECT id FROM forms WHERE created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
);

CREATE POLICY "Authenticated users can submit responses"
ON form_responses FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Step 3: Create index for homepage forms
CREATE INDEX IF NOT EXISTS idx_forms_homepage 
ON forms(show_on_homepage, is_active) 
WHERE show_on_homepage = true AND is_active = true;

-- Step 4: Verify the setup
SELECT 
  'Forms Table' as table_name,
  COUNT(*) as total_forms,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_forms,
  SUM(CASE WHEN show_on_homepage THEN 1 ELSE 0 END) as homepage_forms
FROM forms;

SELECT 
  'Form Fields' as table_name,
  COUNT(*) as total_fields,
  COUNT(DISTINCT form_id) as forms_with_fields
FROM form_fields;

SELECT 
  'Form Responses' as table_name,
  COUNT(*) as total_responses,
  COUNT(DISTINCT form_id) as forms_with_responses,
  COUNT(DISTINCT user_id) as unique_respondents
FROM form_responses;

-- Step 5: Show RLS policies
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN length(qual::text) > 80 THEN substring(qual::text, 1, 80) || '...'
    ELSE qual::text
  END as policy_condition
FROM pg_policies 
WHERE tablename IN ('forms', 'form_fields', 'form_responses')
ORDER BY tablename, cmd, policyname;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Forms system updated successfully!';
  RAISE NOTICE '✅ Added show_on_homepage column';
  RAISE NOTICE '✅ Updated RLS policies for proper access control';
  RAISE NOTICE '✅ Forms can now be displayed on homepage';
  RAISE NOTICE '✅ Form creators can view responses';
END $$;
