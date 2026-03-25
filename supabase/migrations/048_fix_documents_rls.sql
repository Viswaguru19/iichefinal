-- Fix documents table INSERT RLS
DROP POLICY IF EXISTS "Committee members can upload documents" ON documents;
DROP POLICY IF EXISTS "Authorized users can upload documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON documents;

CREATE POLICY "Authenticated users can upload documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Document owners can update" ON documents;
CREATE POLICY "Document owners can update"
  ON documents FOR UPDATE
  USING (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL)));
