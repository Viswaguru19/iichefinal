-- ============================================
-- COMPLETE FORMS FIX - RUN THIS ENTIRE SCRIPT
-- ============================================

-- Step 1: Fix RLS policies for form_fields table
DROP POLICY IF EXISTS "Form creator can insert fields" ON form_fields;
DROP POLICY IF EXISTS "Form creator can update fields" ON form_fields;
DROP POLICY IF EXISTS "Form creator can delete fields" ON form_fields;

CREATE POLICY "Form creator can insert fields" ON form_fields 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.created_by = auth.uid()
  )
);

CREATE POLICY "Form creator can update fields" ON form_fields 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.created_by = auth.uid()
  )
);

CREATE POLICY "Form creator can delete fields" ON form_fields 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.created_by = auth.uid()
  )
);

-- Step 2: Update storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'documents', 
  'documents', 
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

-- Step 3: Check which forms have no fields (for debugging)
SELECT 
  f.id,
  f.title,
  f.created_at,
  COUNT(ff.id) as field_count
FROM forms f
LEFT JOIN form_fields ff ON f.id = ff.form_id
GROUP BY f.id, f.title, f.created_at
ORDER BY f.created_at DESC;

-- Step 4: Delete old forms that have no fields (optional - uncomment if needed)
-- DELETE FROM forms 
-- WHERE id IN (
--   SELECT f.id
--   FROM forms f
--   LEFT JOIN form_fields ff ON f.id = ff.form_id
--   WHERE ff.id IS NULL
-- );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'form_fields'
ORDER BY policyname;

-- Check storage bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'documents';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Forms fix completed! Now create a new form with fields and test.' as status;
