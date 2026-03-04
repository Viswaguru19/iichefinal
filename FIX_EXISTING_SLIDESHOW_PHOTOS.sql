-- Fix Existing Slideshow Photo Paths
-- This removes the 'slideshow/' prefix from photo_url if it exists

-- Check current photo URLs
SELECT id, photo_url, title FROM homepage_slideshow;

-- Fix paths that have 'slideshow/' prefix
UPDATE homepage_slideshow
SET photo_url = REPLACE(photo_url, 'slideshow/', '')
WHERE photo_url LIKE 'slideshow/%';

-- Verify the fix
SELECT id, photo_url, title FROM homepage_slideshow;
