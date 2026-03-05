# Slideshow Signed URLs Fix

## Problem
Public URLs not working even after making bucket public.

## Solution: Use Signed URLs
Signed URLs work even with private buckets and are more secure.

## Implementation

### Option 1: Quick Fix - Make Bucket Public (Simplest)

Run this in Supabase SQL Editor:
```sql
-- Make bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'slideshow-photos';

-- Verify
SELECT id, name, public FROM storage.buckets WHERE id = 'slideshow-photos';
-- Should show: public = true
```

Then clear browser cache and reload.

### Option 2: Use Signed URLs (More Secure)

If public URLs still don't work, modify the code to use signed URLs.

#### For Homepage (Server Component)
```typescript
// In app/page.tsx
const slidesWithUrls = await Promise.all(
  (slideshowPhotos || []).map(async (slide: any) => {
    const { data, error } = await supabase.storage
      .from('slideshow-photos')
      .createSignedUrl(slide.photo_url, 3600); // 1 hour expiry
    
    return {
      ...slide,
      photo_url: data?.signedUrl || ''
    };
  })
);
```

#### For Admin Panel (Client Component)
```typescript
// In app/dashboard/admin/slideshow/page.tsx
const getPhotoUrl = async (path: string) => {
  const { data } = await supabase.storage
    .from('slideshow-photos')
    .createSignedUrl(path, 3600);
  return data?.signedUrl || '';
};
```

### Option 3: Check Storage Configuration

1. Go to Supabase Dashboard → Storage → Configuration
2. Check CORS settings
3. Add your domain or use `*` for testing:
   ```json
   {
     "allowedOrigins": ["*"],
     "allowedMethods": ["GET", "HEAD"],
     "allowedHeaders": ["*"],
     "maxAge": 3600
   }
   ```

## Debugging Steps

### 1. Test Direct URL Access
Open this in browser:
```
https://zaitflfjwxbywukpijww.supabase.co/storage/v1/object/public/slideshow-photos/7c6168b2-f943-4ecb-b24e-dc8a5674f86a.jpg
```

### 2. Check Browser Console
1. Open homepage
2. Press F12
3. Look for errors like:
   - `403 Forbidden` → Bucket not public
   - `404 Not Found` → File doesn't exist
   - `CORS error` → CORS not configured
   - `net::ERR_FAILED` → Network issue

### 3. Verify in Supabase Dashboard
1. Storage → Buckets → slideshow-photos
2. Click on a file
3. Try to get public URL
4. Test if it opens

## Quick Test Query

Run this in Supabase SQL Editor to check everything:
```sql
-- Check bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'slideshow-photos';

-- Check if files exist in storage
SELECT 
  name,
  bucket_id,
  created_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'slideshow-photos'
LIMIT 10;

-- Check database records
SELECT 
  id,
  photo_url,
  title,
  is_active,
  approval_status
FROM homepage_slideshow
ORDER BY display_order;
```

## Expected Results

### Bucket should show:
- `public = true`
- `file_size_limit = 5242880` (5MB)
- `allowed_mime_types = {image/jpeg, image/png, image/gif, image/webp}`

### Files should exist in storage.objects
- Should see 3 files matching your database records

### Database should match storage
- `photo_url` in database should match `name` in storage.objects

## If Nothing Works

Try re-uploading one image:
1. Go to `/dashboard/admin/slideshow`
2. Delete one existing photo
3. Upload a new test image
4. Check if it appears on homepage
5. If yes, re-upload the others
