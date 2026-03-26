
INSERT INTO storage.buckets (id, name, public)
VALUES ('cal-fotos', 'cal-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload cal photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cal-fotos');

CREATE POLICY "Anyone can view cal photos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'cal-fotos');
