-- Nuclear fix: drop ALL storage policies and recreate clean ones
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Ensure all buckets exist
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('posters', 'posters', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('event-photos', 'event-photos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('slideshow-photos', 'slideshow-photos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('event-documents', 'event-documents', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- Universal SELECT: anyone can view any public bucket
CREATE POLICY "public_read_all" ON storage.objects FOR SELECT USING (true);

-- Universal INSERT: any authenticated user can upload to any bucket
CREATE POLICY "auth_upload_all" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Universal UPDATE: any authenticated user can update
CREATE POLICY "auth_update_all" ON storage.objects FOR UPDATE USING (auth.role() = 'authenticated');

-- Universal DELETE: any authenticated user can delete
CREATE POLICY "auth_delete_all" ON storage.objects FOR DELETE USING (auth.role() = 'authenticated');
