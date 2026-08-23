-- Fix committee_documents INSERT RLS
DROP POLICY IF EXISTS "Committee members can upload documents" ON committee_documents;
CREATE POLICY "Authenticated users can upload committee documents"
  ON committee_documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix committee_documents SELECT RLS
DROP POLICY IF EXISTS "Committee and executive can view documents" ON committee_documents;
CREATE POLICY "Anyone can view committee documents"
  ON committee_documents FOR SELECT
  USING (auth.uid() IS NOT NULL);
