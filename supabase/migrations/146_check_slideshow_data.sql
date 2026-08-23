-- Check Slideshow Photos in Database

-- 1. Check all slideshow photos
SELECT 
    id,
    photo_url,
    title,
    is_active,
    approval_status,
    display_order,
    created_at
FROM homepage_slideshow
ORDER BY display_order;

-- 2. Check only active and approved photos (what homepage shows)
SELECT 
    id,
    photo_url,
    title,
    is_active,
    approval_status,
    display_order
FROM homepage_slideshow
WHERE is_active = true 
AND approval_status = 'approved'
ORDER BY display_order;

-- 3. Check if photos exist in storage
-- Run this in Supabase Storage section, not SQL editor
-- Go to Storage → slideshow-photos bucket
-- You should see files like: uuid.jpg, uuid.png, etc.

-- 4. Fix photo paths if they have 'slideshow/' prefix
UPDATE homepage_slideshow
SET photo_url = REPLACE(photo_url, 'slideshow/', '')
WHERE photo_url LIKE 'slideshow/%';

-- 5. Verify the fix
SELECT photo_url FROM homepage_slideshow;

-- Expected format: 'abc123-def456.jpg' (just filename)
-- NOT: 'slideshow/abc123-def456.jpg'
