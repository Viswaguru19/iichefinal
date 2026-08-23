-- Event Photos table - anyone authenticated can upload, everyone can view
CREATE TABLE IF NOT EXISTS event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view event photos" ON event_photos;
CREATE POLICY "Anyone can view event photos" ON event_photos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can upload event photos" ON event_photos;
CREATE POLICY "Authenticated users can upload event photos" ON event_photos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Photo owners or admins can delete" ON event_photos;
CREATE POLICY "Photo owners or admins can delete" ON event_photos FOR DELETE USING (
  uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL))
);

-- Fix event_reports table - add missing columns to existing table
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS report_content TEXT;
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS additional_details TEXT;
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE event_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Storage bucket for event photos
INSERT INTO storage.buckets (id, name, public) VALUES ('event-photos', 'event-photos', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view event photos storage" ON storage.objects;
CREATE POLICY "Anyone can view event photos storage" ON storage.objects FOR SELECT USING (bucket_id = 'event-photos');
DROP POLICY IF EXISTS "Authenticated users can upload event photos storage" ON storage.objects;
CREATE POLICY "Authenticated users can upload event photos storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-photos' AND auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON event_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reports_event_id ON event_reports(event_id);
