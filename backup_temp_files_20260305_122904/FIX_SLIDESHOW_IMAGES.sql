-- Fix Slideshow Images Loading Issue
-- Run this in Supabase SQL Editor

-- Step 1: Ensure the bucket exists and is public
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

-- Step 2: Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_admin_delete" ON storage.objects;

-- Step 3: Create new policies with correct permissions
-- Allow EVERYONE (including anonymous users) to view slideshow photos
CREATE POLICY "slideshow_photos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'slideshow-photos');

-- Allow super_admin and secretary to upload
CREATE POLICY "slideshow_photos_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('super_admin', 'secretary')
  )
);

-- Allow super_admin and secretary to update
CREATE POLICY "slideshow_photos_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('super_admin', 'secretary')
  )
);

-- Allow super_admin and secretary to delete
CREATE POLICY "slideshow_photos_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('super_admin', 'secretary')
  )
);

-- Step 4: Verify bucket configuration
SELECT 
  id, 
  name, 
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'slideshow-photos';

-- Step 5: Check existing photos
SELECT 
  id,
  photo_url,
  title,
  is_active,
  approval_status,
  display_order
FROM homepage_slideshow
ORDER BY display_order;

-- Step 6: Verify storage policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%slideshow%';
