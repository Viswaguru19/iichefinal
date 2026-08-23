-- Migration: Gallery and Slideshow Tables
-- Description: Create tables for photo gallery, albums, and homepage slideshow
-- Phase 1, Task 1.1

-- Gallery Albums Table
CREATE TABLE IF NOT EXISTS gallery_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_photo_url TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gallery Photos Table
CREATE TABLE IF NOT EXISTS gallery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID REFERENCES gallery_albums(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Homepage Slideshow Table
CREATE TABLE IF NOT EXISTS homepage_slideshow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  link_url TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gallery_albums_event ON gallery_albums(event_id);
CREATE INDEX IF NOT EXISTS idx_gallery_albums_featured ON gallery_albums(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_gallery_photos_album ON gallery_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_approval ON gallery_photos(approval_status);
CREATE INDEX IF NOT EXISTS idx_slideshow_active ON homepage_slideshow(is_active, display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_slideshow_approval ON homepage_slideshow(approval_status);

-- RLS Policies
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_slideshow ENABLE ROW LEVEL SECURITY;

-- Gallery Albums Policies
CREATE POLICY "Anyone can view albums" ON gallery_albums FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create albums" ON gallery_albums FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update own albums" ON gallery_albums FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Admins can update any album" ON gallery_albums FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Gallery Photos Policies
CREATE POLICY "Anyone can view approved photos" ON gallery_photos FOR SELECT USING (approval_status = 'approved');
CREATE POLICY "Users can view own photos" ON gallery_photos FOR SELECT USING (auth.uid() = uploaded_by);
CREATE POLICY "Authenticated users can upload photos" ON gallery_photos FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "EC can approve photos" ON gallery_photos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND executive_role IS NOT NULL)
);

-- Slideshow Policies
CREATE POLICY "Anyone can view active approved slides" ON homepage_slideshow FOR SELECT USING (
  is_active = true AND approval_status = 'approved'
);
CREATE POLICY "Admins can view all slides" ON homepage_slideshow FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Authenticated users can upload slides" ON homepage_slideshow FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "EC can manage slides" ON homepage_slideshow FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL))
);

-- Comments
COMMENT ON TABLE gallery_albums IS 'Photo albums for events and general gallery';
COMMENT ON TABLE gallery_photos IS 'Individual photos within albums';
COMMENT ON TABLE homepage_slideshow IS 'Photos for homepage hero slideshow';
