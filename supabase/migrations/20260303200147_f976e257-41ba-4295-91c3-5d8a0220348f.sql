
-- Create storage bucket for OCR weight photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedreira-ocr-fotos', 'pedreira-ocr-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload ocr photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pedreira-ocr-fotos');

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read ocr photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pedreira-ocr-fotos');
