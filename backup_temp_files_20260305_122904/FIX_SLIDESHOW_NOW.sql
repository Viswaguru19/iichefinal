-- COMPLETE FIX FOR SLIDESHOW IMAGES
-- Run this in Supabase SQL Editor

-- Step 1: Ensure bucket exists and is PUBLIC
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'slideshow-photos', 
  'slideshow-photos', 
  true,  -- MUST BE TRUE for public access
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Step 2: Remove ALL existing policies to start fresh
DROP POLICY IF EXISTS "Public can view slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "slideshow_photos_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload slideshow" ON storage.objects;

-- Step 3: Create simple PUBLIC READ policy (no authentication required)
CREATE POLICY "slideshow_public_access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'slideshow-photos');

-- Step 4: Allow authenticated users to upload
CREATE POLICY "slideshow_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'slideshow-photos'
  AND (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'secretary')
    )
    OR auth.uid() IS NOT NULL
  )
);

-- Step 5: Allow authenticated users to update/delete their uploads
CREATE POLICY "slideshow_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'slideshow-photos');

CREATE POLICY "slideshow_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'slideshow-photos');

-- Step 6: Verify configuration
SELECT 
  id, 
  name, 
  public as "Is Public?",
  file_size_limit as "Max Size (bytes)",
  allowed_mime_types as "Allowed Types"
FROM storage.buckets 
WHERE id = 'slideshow-photos';

-- Expected output: public should be TRUE

-- Step 7: Check if any photos exist
SELECT 
  id,
  photo_url as "Filename in Storage",
  title,
  is_active,
  approval_status
FROM homepage_slideshow
ORDER BY display_order;

-- Step 8: List actual files in storage (run this separately in Storage UI)
-- Go to: Storage → slideshow-photos → Check if files exist

-- Step 9: Test a public URL (replace FILENAME with actual file)
-- Format: https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/slideshow-photos/FILENAME.jpg
-- Copy a filename from Step 7 and test in browser
