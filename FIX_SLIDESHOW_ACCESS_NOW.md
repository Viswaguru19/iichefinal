# Fix Slideshow Access - Run This Now! 🔧

## Problem
You're getting "Access denied" when trying to add slideshow photos because the RLS policies are checking for old fields (`is_admin`, `executive_role`) instead of the current `role` field.

## Solution
Run these SQL scripts in your Supabase SQL Editor:

### Step 1: Fix Database Policies
Copy and run `FIX_SLIDESHOW_ACCESS.sql` in Supabase SQL Editor

This will:
- Update RLS policies for `homepage_slideshow` table
- Update RLS policies for `gallery_albums` table  
- Update RLS policies for `gallery_photos` table
- Allow users with role 'super_admin' or 'secretary' to manage slideshow

### Step 2: Fix Storage Bucket Policies
Copy and run `FIX_SLIDESHOW_STORAGE.sql` in Supabase SQL Editor

This will:
- Ensure `slideshow-photos` bucket exists
- Create/update storage policies
- Allow super_admin and secretary to upload/delete photos
- Make photos publicly viewable

## Quick Fix (All-in-One)

Run this complete script in Supabase SQL Editor:

```sql
-- Fix homepage_slideshow table policies
DROP POLICY IF EXISTS "Admins can view all slides" ON homepage_slideshow;
DROP POLICY IF EXISTS "EC can manage slides" ON homepage_slideshow;

CREATE POLICY "Admins can view all slides" ON homepage_slideshow 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

CREATE POLICY "Admins can manage slides" ON homepage_slideshow 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- Fix storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('slideshow-photos', 'slideshow-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public can view slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update slideshow photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete slideshow photos" ON storage.objects;

CREATE POLICY "Public can view slideshow photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'slideshow-photos');

CREATE POLICY "Admins can upload slideshow photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

CREATE POLICY "Admins can update slideshow photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

CREATE POLICY "Admins can delete slideshow photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'slideshow-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);
```

## After Running the SQL

1. Refresh your browser
2. Go to `/dashboard/admin/slideshow`
3. You should now be able to upload photos!

## Verify Your Role

Make sure your user has the correct role:

```sql
-- Check your current role
SELECT id, email, role FROM profiles WHERE email = 'your-email@example.com';

-- If needed, update your role to super_admin
UPDATE profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';
```

## Who Can Access?

After this fix, slideshow management is available to:
- Users with role = 'super_admin'
- Users with role = 'secretary'

## Troubleshooting

**Still getting access denied?**
1. Check your role in the database
2. Clear browser cache and cookies
3. Log out and log back in
4. Verify the SQL ran without errors

**Upload fails?**
1. Check file size (must be under 5MB)
2. Verify file is an image (PNG, JPG, GIF)
3. Check browser console for errors

Need help? The code changes are already applied to the frontend!
