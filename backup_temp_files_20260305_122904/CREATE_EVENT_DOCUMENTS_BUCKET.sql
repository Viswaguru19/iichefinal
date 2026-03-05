-- ============================================
-- CREATE EVENT DOCUMENTS STORAGE BUCKET
-- ============================================
-- This creates a storage bucket for event proposal documents
-- ============================================

-- Create the storage bucket for event documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for event-documents bucket
CREATE POLICY IF NOT EXISTS "Anyone can view event documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload event documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-documents' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY IF NOT EXISTS "Users can update their own event documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'event-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "Users can delete their own event documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Verify bucket creation
SELECT 
  'Event documents bucket:' as info,
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'event-documents';
