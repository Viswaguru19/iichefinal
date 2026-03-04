-- Migration: Public Profile Settings
-- Description: Add privacy settings and social links to profiles
-- Phase 1, Task 1.3

-- Add public profile settings
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT;

-- Comments
COMMENT ON COLUMN profiles.show_email IS 'Whether to show email on public profile';
COMMENT ON COLUMN profiles.show_phone IS 'Whether to show phone on public profile';
COMMENT ON COLUMN profiles.social_links IS 'JSON object with social media links';
COMMENT ON COLUMN profiles.linkedin_url IS 'LinkedIn profile URL';
COMMENT ON COLUMN profiles.github_url IS 'GitHub profile URL';
COMMENT ON COLUMN profiles.twitter_url IS 'Twitter/X profile URL';
