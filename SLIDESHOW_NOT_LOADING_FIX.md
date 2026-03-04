# Slideshow Photos Not Loading - Troubleshooting Guide

## Quick Diagnosis

Visit `/test-slideshow` to see:
- What photos are in the database
- What URLs are being generated
- Which images are failing to load
- Error messages

## Common Issues & Fixes

### Issue 1: Photos Have Wrong Path Format

**Problem:** Photo URLs stored as `slideshow/uuid.jpg` instead of `uuid.jpg`

**Fix:** Run this SQL in Supabase:
```sql
UPDATE homepage_slideshow
SET photo_url = REPLACE(photo_url, 'slideshow/', '')
WHERE photo_url LIKE 'slideshow/%';
```

### Issue 2: Photos Not Marked as Active/Approved

**Problem:** Photos exist but aren't showing because they're inactive or pending

**Check:** Run this SQL:
```sql
SELECT id, photo_url, is_active, approval_status 
FROM homepage_slideshow;
```

**Fix:** Activate and approve photos:
```sql
UPDATE homepage_slideshow
SET is_active = true, approval_status = 'approved'
WHERE id = 'your-photo-id';
```

### Issue 3: Storage Bucket Not Public

**Problem:** Storage bucket isn't publicly accessible

**Fix in Supabase:**
1. Go to Storage → slideshow-photos
2. Click bucket settings (gear icon)
3. Make sure "Public bucket" is enabled
4. Or run this SQL:
```sql
UPDATE storage.buckets 
SET public = true 
WHERE name = 'slideshow-photos';
```

### Issue 4: RLS Policies Blocking Access

**Problem:** Row Level Security policies preventing public access

**Fix:** Run the complete policy fix:
```sql
-- Allow public to view slideshow photos
CREATE POLICY "Public can view slideshow photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'slideshow-photos');
```

### Issue 5: Files Not Actually Uploaded

**Problem:** Database has records but files don't exist in storage

**Check in Supabase:**
1. Go to Storage → slideshow-photos
2. Look for your image files
3. If empty, files weren't uploaded

**Fix:** Re-upload photos through `/dashboard/admin/slideshow`

### Issue 6: CORS Issues

**Problem:** Browser blocking image requests

**Check:** Open browser console (F12) and look for CORS errors

**Fix:** Ensure Supabase project has correct CORS settings

## Step-by-Step Debugging

### Step 1: Check Database
```sql
SELECT * FROM homepage_slideshow 
WHERE is_active = true 
AND approval_status = 'approved';
```

Expected result: At least one row with a photo_url

### Step 2: Check Storage
1. Go to Supabase → Storage → slideshow-photos
2. Verify files exist
3. Click a file → Copy URL
4. Paste URL in browser - should show image

### Step 3: Check Photo Paths
Photo URLs should be just filenames:
- ✅ Good: `abc123-def456.jpg`
- ❌ Bad: `slideshow/abc123-def456.jpg`
- ❌ Bad: `/slideshow/abc123-def456.jpg`

### Step 4: Test Public URL
```sql
-- Get a photo URL
SELECT photo_url FROM homepage_slideshow LIMIT 1;
```

Then construct URL manually:
```
https://YOUR_PROJECT.supabase.co/storage/v1/object/public/slideshow-photos/FILENAME.jpg
```

Paste in browser - should show image.

### Step 5: Check Browser Console
1. Open homepage
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Look for errors (red text)
5. Look for 404 errors (file not found)
6. Look for 403 errors (permission denied)

## Quick Fixes to Try

### Fix 1: Clean and Re-upload
```sql
-- Delete all slideshow photos
DELETE FROM homepage_slideshow;

-- Then re-upload through admin panel
```

### Fix 2: Reset Storage Policies
Run `FIX_SLIDESHOW_STORAGE.sql` from the project root

### Fix 3: Verify Bucket Exists
```sql
SELECT * FROM storage.buckets WHERE name = 'slideshow-photos';
```

If empty, create bucket:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('slideshow-photos', 'slideshow-photos', true);
```

## Test Checklist

- [ ] Photos visible in `/dashboard/admin/slideshow`
- [ ] Photos marked as active (green eye icon)
- [ ] Files exist in Storage → slideshow-photos
- [ ] Photo URLs are just filenames (no `slideshow/` prefix)
- [ ] Bucket is public
- [ ] RLS policies allow public SELECT
- [ ] No errors in browser console
- [ ] Test page `/test-slideshow` shows images

## Still Not Working?

1. Share screenshot of `/test-slideshow` page
2. Share browser console errors (F12 → Console)
3. Share result of this SQL:
```sql
SELECT id, photo_url, is_active, approval_status 
FROM homepage_slideshow;
```

This will help identify the exact issue!
