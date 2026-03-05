-- Fix Slideshow Storage Bucket Policies
-- Ensure super_admin and secretary can upload to slideshow-photos bucket

-- First, check if bucket exists (run this in Supabase SQL Editor)
SELECT * FROM storage.buckets WHERE name = 'slideshow-photos';

-- If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('slideshow-photos', 'slideshow-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete slideshow photos" ON storage.objects;

-- Create new policies
-- 1. Anyone can view slideshow photos (public bucket)
CREATE POLICY "Public can view slideshow photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'slideshow-photos');

-- 2. Super admin and secretary can upload
CREATE POLICY "Admins can upload slideshow photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- 3. Super admin and secretary can update
CREATE POLICY "Admins can update slideshow photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- 4. Super admin and secretary can delete
CREATE POLICY "Admins can delete slideshow photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- Verify storage policies
SELECT * FROM storage.buckets WHERE name = 'slideshow-photos';
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%slideshow%';
