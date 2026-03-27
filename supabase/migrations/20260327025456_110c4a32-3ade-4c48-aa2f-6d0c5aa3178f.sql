-- Create storage buckets for photos if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('pedreira-ocr-fotos', 'pedreira-ocr-fotos', true),
  ('cal-fotos', 'cal-fotos', true),
  ('avatars', 'avatars', true),
  ('rdo-fotos', 'rdo-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for buckets (public read, authenticated write)
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id IN ('pedreira-ocr-fotos', 'cal-fotos', 'avatars', 'rdo-fotos'));

CREATE POLICY "Authenticated Upload Access" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id IN ('pedreira-ocr-fotos', 'cal-fotos', 'avatars', 'rdo-fotos') 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Update Access" ON storage.objects FOR UPDATE USING (
  bucket_id IN ('pedreira-ocr-fotos', 'cal-fotos', 'avatars', 'rdo-fotos') 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Delete Access" ON storage.objects FOR DELETE USING (
  bucket_id IN ('pedreira-ocr-fotos', 'cal-fotos', 'avatars', 'rdo-fotos') 
  AND auth.role() = 'authenticated'
);
