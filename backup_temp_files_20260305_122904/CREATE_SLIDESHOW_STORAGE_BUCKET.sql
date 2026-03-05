-- Create storage bucket for slideshow photos
-- Run this in Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('slideshow-photos', 'slideshow-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for slideshow-photos bucket

-- Allow public to read
CREATE POLICY "Public can view slideshow photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'slideshow-photos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload slideshow photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'slideshow-photos');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own slideshow photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'slideshow-photos' AND auth.uid() = owner);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own slideshow photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'slideshow-photos' AND auth.uid() = owner);

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'slideshow-photos';
