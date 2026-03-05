# Test Slideshow Image URLs

## Your Supabase Project
- URL: `https://zaitflfjwxbywukpijww.supabase.co`
- Project Ref: `zaitflfjwxbywukpijww`

## Expected Image URLs

Based on your database, the images should be at:

1. `https://zaitflfjwxbywukpijww.supabase.co/storage/v1/object/public/slideshow-photos/7c6168b2-f943-4ecb-b24e-dc8a5674f86a.jpg`

2. `https://zaitflfjwxbywukpijww.supabase.co/storage/v1/object/public/slideshow-photos/8ec4ac32-5fea-4805-8722-4cf1533eb12f.jpg`

3. `https://zaitflfjwxbywukpijww.supabase.co/storage/v1/object/public/slideshow-photos/13b9c996-7f98-47cf-8c4e-58b378a83667.jpg`

## Quick Test

1. **Copy one of the URLs above**
2. **Paste it in a new browser tab**
3. **What happens?**
   - ✅ Image loads → Bucket is public, issue is in code
   - ❌ 404 Error → File doesn't exist in storage
   - ❌ 403 Error → Bucket is not public (run SQL fix)
   - ❌ CORS Error → Need to configure CORS

## Steps to Fix

### Step 1: Verify Bucket Exists and is Public
1. Go to: https://supabase.com/dashboard/project/zaitflfjwxbywukpijww/storage/buckets
2. Find `slideshow-photos` bucket
3. Check if "Public bucket" toggle is ON
4. If OFF, turn it ON

### Step 2: Run SQL Fix (if bucket not public)
```sql
-- Run this in Supabase SQL Editor
UPDATE storage.buckets 
SET public = true 
WHERE id = 'slideshow-photos';
```

### Step 3: Verify Files Exist
1. Go to: https://supabase.com/dashboard/project/zaitflfjwxbywukpijww/storage/buckets/slideshow-photos
2. Check if these files exist:
   - `7c6168b2-f943-4ecb-b24e-dc8a5674f86a.jpg`
   - `8ec4ac32-5fea-4805-8722-4cf1533eb12f.jpg`
   - `13b9c996-7f98-47cf-8c4e-58b378a83667.jpg`

### Step 4: Check RLS Policies
```sql
-- Run this to see current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%slideshow%';
```

## Alternative: Use Signed URLs (Temporary Fix)

If public URLs don't work, we can use signed URLs that work even with private buckets.

Let me know what error you get when testing the URLs above!
