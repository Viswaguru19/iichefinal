-- Comprehensive fix for documents table AND storage RLS policies
-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================

-- ==========================================
-- PART 1: Fix storage.objects policies for 'documents' bucket
-- ==========================================
-- Drop ALL existing storage policies for documents bucket
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND (policyname ILIKE '%document%' OR policyname ILIKE '%committee%doc%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage: Anyone can read
CREATE POLICY "documents_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- Storage: Any authenticated user can upload
CREATE POLICY "documents_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Storage: Any authenticated user can update their uploads
CREATE POLICY "documents_storage_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Storage: Any authenticated user can delete
CREATE POLICY "documents_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- ==========================================
-- PART 2: Fix documents table RLS policies
-- ==========================================
DROP POLICY IF EXISTS "Documents viewable by committee members" ON documents;
DROP POLICY IF EXISTS "Committee members can upload documents" ON documents;
DROP POLICY IF EXISTS "Uploaders can delete their documents" ON documents;
DROP POLICY IF EXISTS "Authorized users can upload documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON documents;
DROP POLICY IF EXISTS "Document owners can update" ON documents;
DROP POLICY IF EXISTS "Anyone can view documents" ON documents;
DROP POLICY IF EXISTS "documents_select_authenticated" ON documents;
DROP POLICY IF EXISTS "documents_insert_authenticated" ON documents;
DROP POLICY IF EXISTS "documents_update_owner_or_admin" ON documents;
DROP POLICY IF EXISTS "documents_delete_owner_or_admin" ON documents;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_authenticated"
  ON documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "documents_insert_authenticated"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "documents_update_owner_or_admin"
  ON documents FOR UPDATE
  USING (
    uploaded_by = auth.uid() 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL))
  );

CREATE POLICY "documents_delete_owner_or_admin"
  ON documents FOR DELETE
  USING (
    uploaded_by = auth.uid() 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL))
  );
