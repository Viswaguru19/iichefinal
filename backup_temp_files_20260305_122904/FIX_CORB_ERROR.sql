-- Fix CORB Error for Slideshow Photos
-- This ensures the storage bucket is public and accessible

-- Step 1: Make sure bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'slideshow-photos', 
  'slideshow-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Step 2: Drop ALL existing policies for this bucket
DROP POLICY IF EXISTS "Public can view slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete slideshow photos" ON storage.objects;

-- Step 3: Create simple, permissive policies
-- Allow EVERYONE to view photos (no authentication required)
CREATE POLICY "slideshow_public_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'slideshow-photos');

-- Allow authenticated users with correct role to upload
CREATE POLICY "slideshow_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- Allow authenticated users with correct role to update
CREATE POLICY "slideshow_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- Allow authenticated users with correct role to delete
CREATE POLICY "slideshow_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- Step 4: Verify bucket is public
SELECT id, name, public FROM storage.buckets WHERE name = 'slideshow-photos';
-- Should show: public = true

-- Step 5: Verify policies exist
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE 'slideshow%';

-- Step 6: Test public access (copy a photo URL and paste in browser)
-- URL format: https://YOUR_PROJECT.supabase.co/storage/v1/object/public/slideshow-photos/FILENAME.jpg
