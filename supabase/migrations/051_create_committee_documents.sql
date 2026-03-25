-- Create committee_documents table since it doesn't exist yet
CREATE TABLE IF NOT EXISTS committee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE committee_documents ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to view
CREATE POLICY "Anyone can view committee_documents"
  ON committee_documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow any authenticated user to insert
CREATE POLICY "Anyone can upload committee_documents"
  ON committee_documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow uploaders to delete their own docs
CREATE POLICY "Uploaders can delete committee_documents"
  ON committee_documents FOR DELETE
  USING (uploaded_by = auth.uid());
