-- Fix statement_of_accounts RLS to explicitly allow DELETE for treasurer/secretary
DROP POLICY IF EXISTS "Treasurer and Secretary can manage accounts" ON statement_of_accounts;

CREATE POLICY "Treasurer and Secretary can manage accounts"
  ON statement_of_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.executive_role IN ('treasurer', 'secretary', 'associate_treasurer') OR profiles.role = 'super_admin' OR profiles.is_admin = true OR profiles.is_faculty = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.executive_role IN ('treasurer', 'secretary', 'associate_treasurer') OR profiles.role = 'super_admin' OR profiles.is_admin = true OR profiles.is_faculty = true)
    )
  );

-- Fix storage upload RLS - ensure authenticated users can upload to documents bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload documents storage" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read documents storage" ON storage.objects;
CREATE POLICY "Anyone can read documents storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');
