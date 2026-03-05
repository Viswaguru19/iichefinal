-- URGENT: Run this migration to fix the profile description error
-- Copy and paste this into your Supabase SQL Editor

-- Add description column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for text search on descriptions (optional, for future search features)
CREATE INDEX IF NOT EXISTS idx_profiles_description 
ON profiles USING gin(to_tsvector('english', description))
WHERE description IS NOT NULL;

-- Comment
COMMENT ON COLUMN profiles.description IS 'User bio/description shown on profile page';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'description';
