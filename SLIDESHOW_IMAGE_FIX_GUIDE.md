# Slideshow Image Loading Fix Guide

## Problem
Images are not loading in the homepage slideshow.

## Root Causes
1. Storage bucket `slideshow-photos` might not be properly configured as public
2. RLS policies might be blocking public access
3. Image URLs might be malformed
4. CORS issues with storage bucket

## Solution Steps

### Step 1: Run the SQL Fix
Run the `FIX_SLIDESHOW_IMAGES.sql` file in your Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `FIX_SLIDESHOW_IMAGES.sql`
3. Click "Run"
4. Verify the output shows the bucket is public

### Step 2: Verify Bucket Configuration
In Supabase Dashboard:
1. Go to Storage → Buckets
2. Find `slideshow-photos` bucket
3. Click on it and check:
   - ✅ Public bucket should be enabled
   - ✅ File size limit: 5MB
   - ✅ Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

### Step 3: Test Image Upload
1. Go to `/dashboard/admin/slideshow` in your app
2. Upload a test image
3. Check if it appears in the list
4. Verify the image URL format looks like:
   ```
   https://YOUR_PROJECT.supabase.co/storage/v1/object/public/slideshow-photos/FILENAME.jpg
   ```

### Step 4: Check Browser Console
1. Open your homepage
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for any errors related to image loading
5. Check Network tab for failed image requests

### Step 5: Verify Image URLs
The homepage should generate URLs like this:
```typescript
const { data } = supabase.storage
  .from('slideshow-photos')
  .getPublicUrl(slide.photo_url);
```

Make sure `slide.photo_url` contains just the filename (e.g., `abc123.jpg`), not the full URL.

## Common Issues and Fixes

### Issue 1: "Failed to load image" error
**Cause**: Storage bucket not public or RLS blocking access
**Fix**: Run `FIX_SLIDESHOW_IMAGES.sql` to ensure public access

### Issue 2: CORS errors in console
**Cause**: Supabase storage CORS not configured
**Fix**: In Supabase Dashboard → Storage → Configuration → CORS:
- Add your domain (e.g., `http://localhost:3000`, `https://yourdomain.com`)
- Or use `*` for development (not recommended for production)

### Issue 3: 404 errors for images
**Cause**: Image file doesn't exist in storage or wrong filename
**Fix**: 
1. Check Supabase Storage → slideshow-photos bucket
2. Verify files exist
3. Check database `homepage_slideshow` table has correct filenames

### Issue 4: Images work in admin panel but not on homepage
**Cause**: Different URL generation methods
**Fix**: Ensure both use the same method:
```typescript
const { data } = supabase.storage
  .from('slideshow-photos')
  .getPublicUrl(filename);
```

## Testing Checklist

- [ ] SQL fix executed successfully
- [ ] Bucket shows as public in Supabase Dashboard
- [ ] Can upload images via admin panel
- [ ] Images appear in admin panel list
- [ ] Images load on homepage
- [ ] No console errors
- [ ] Images work for anonymous users (logged out)

## Quick Test

1. Log out of your app
2. Visit the homepage as an anonymous user
3. Images should load without authentication

If images still don't load, check:
- Browser console for specific error messages
- Network tab for the actual HTTP response
- Supabase logs for any access denied errors

## Need More Help?

If images still don't load after following these steps:
1. Check the browser console error message
2. Copy the failing image URL
3. Try opening it directly in a new browser tab
4. Check what error you get (404, 403, CORS, etc.)
