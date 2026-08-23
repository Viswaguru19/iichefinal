-- Public bucket for in-meeting chat images and documents (upload via anon + authenticated).

INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-chat', 'meeting-chat', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Meeting chat objects are publicly readable" ON storage.objects;
CREATE POLICY "Meeting chat objects are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meeting-chat');

DROP POLICY IF EXISTS "Anyone can upload meeting chat files" ON storage.objects;
CREATE POLICY "Anyone can upload meeting chat files"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'meeting-chat'
    AND position(E'\n' in name) = 0
    AND length(name) < 512
  );
