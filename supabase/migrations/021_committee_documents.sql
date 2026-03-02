-- Committee documents table
CREATE TABLE committee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE committee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Committee and executive can view documents" ON committee_documents FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM committee_members 
    WHERE user_id = auth.uid() AND committee_id = committee_documents.committee_id
  ) OR
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND executive_role IS NOT NULL
  )
);

CREATE POLICY "Committee members can upload documents" ON committee_documents FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM committee_members 
    WHERE user_id = auth.uid() AND committee_id = committee_documents.committee_id
  )
);

CREATE POLICY "Committee members can delete own documents" ON committee_documents FOR DELETE USING (
  uploaded_by = auth.uid()
);
