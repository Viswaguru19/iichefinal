-- Migration: Add Description to Profiles
-- Description: Add bio/description field to profiles table

-- Add description column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for text search on descriptions (optional, for future search features)
CREATE INDEX IF NOT EXISTS idx_profiles_description 
ON profiles USING gin(to_tsvector('english', description))
WHERE description IS NOT NULL;

-- Comment
COMMENT ON COLUMN profiles.description IS 'User bio/description shown on profile page';
