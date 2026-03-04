# Slideshow Photos Fixed! ✅

## What Was Wrong

The slideshow photos were appearing black because:
1. Photo paths were stored with `slideshow/` prefix (e.g., `slideshow/uuid.jpg`)
2. When generating public URLs, this caused incorrect paths
3. The homepage wasn't converting storage paths to public URLs

## What Was Fixed

### 1. Homepage (app/page.tsx)
- Now converts storage paths to public URLs before passing to HeroSlideshow
- Uses `supabase.storage.from('slideshow-photos').getPublicUrl()`

### 2. Upload Process (app/dashboard/admin/slideshow/page.tsx)
- Changed to upload files without the `slideshow/` prefix
- Now stores just the filename (e.g., `uuid.jpg`) in the database
- This matches how the storage bucket expects paths

## Fix Existing Photos

If you already uploaded photos with the old format, run this SQL in Supabase:

```sql
-- Remove 'slideshow/' prefix from existing photo URLs
UPDATE homepage_slideshow
SET photo_url = REPLACE(photo_url, 'slideshow/', '')
WHERE photo_url LIKE 'slideshow/%';
```

## How to Test

1. Go to `/dashboard/admin/slideshow`
2. Upload a new photo
3. Go to the homepage (`/`)
4. You should see the photo in the slideshow!

## Storage Structure

**Bucket:** `slideshow-photos`
**File path in storage:** `uuid.jpg` (just the filename)
**Database photo_url:** `uuid.jpg` (matches storage path)
**Public URL:** Generated automatically by Supabase

## Troubleshooting

**Still seeing black photos?**
1. Run the SQL fix above for existing photos
2. Check browser console for 404 errors
3. Verify the storage bucket is public
4. Check that photos are marked as `is_active = true` and `approval_status = 'approved'`

**New uploads not working?**
1. Verify you ran the RLS policy fixes from `FIX_SLIDESHOW_ACCESS.sql`
2. Check your role is 'super_admin' or 'secretary'
3. Clear browser cache

**Photos show in admin but not homepage?**
1. Check `is_active` is true
2. Check `approval_status` is 'approved'
3. Hard refresh the homepage (Ctrl+Shift+R)

Everything should work now! Upload photos and they'll appear immediately on the homepage.
