-- Fix Slideshow Access Policies
-- Update RLS policies to use the correct role field

-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all slides" ON homepage_slideshow;
DROP POLICY IF EXISTS "EC can manage slides" ON homepage_slideshow;

-- Create new policies with correct role checks
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

-- Also update gallery policies for consistency
DROP POLICY IF EXISTS "Admins can update any album" ON gallery_albums;
DROP POLICY IF EXISTS "EC can approve photos" ON gallery_photos;

CREATE POLICY "Admins can update any album" ON gallery_albums 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

CREATE POLICY "Admins can approve photos" ON gallery_photos 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'secretary')
  )
);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('homepage_slideshow', 'gallery_albums', 'gallery_photos')
ORDER BY tablename, policyname;
