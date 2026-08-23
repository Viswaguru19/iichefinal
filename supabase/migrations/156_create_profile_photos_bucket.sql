-- ============================================
-- PROFILE PHOTOS STORAGE BUCKET
-- Create storage bucket for user profile photos
-- ============================================

-- Create profile-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete profile photos" ON storage.objects;

-- Allow public read access to profile photos
CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

-- Allow admins to upload profile photos
CREATE POLICY "Admins can upload profile photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'super_admin' OR profiles.is_admin = true)
  )
);

-- Allow admins to update profile photos
CREATE POLICY "Admins can update profile photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'super_admin' OR profiles.is_admin = true)
  )
);

-- Allow admins to delete profile photos
CREATE POLICY "Admins can delete profile photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'super_admin' OR profiles.is_admin = true)
  )
);

-- Add profile_photo column to profiles table if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_photo TEXT;

COMMENT ON COLUMN profiles.profile_photo IS 'URL to user profile photo in storage';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PROFILE PHOTOS BUCKET READY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '✅ profile-photos storage bucket (public)';
  RAISE NOTICE '✅ Storage policies for admin access';
  RAISE NOTICE '✅ profile_photo column in profiles table';
  RAISE NOTICE '';
  RAISE NOTICE 'Admins can now upload profile photos for users';
  RAISE NOTICE '========================================';
END $$;
