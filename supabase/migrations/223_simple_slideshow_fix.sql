-- SIMPLEST FIX - Just make the bucket public
-- Copy and paste this single line into Supabase SQL Editor and click Run

UPDATE storage.buckets SET public = true WHERE id = 'slideshow-photos';

-- Verify it worked (should show public = true)
SELECT id, name, public FROM storage.buckets WHERE id = 'slideshow-photos';
