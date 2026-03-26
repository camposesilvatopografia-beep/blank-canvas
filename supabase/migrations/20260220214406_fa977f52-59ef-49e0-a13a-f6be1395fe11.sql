
-- Adiciona política de insert para PDFs no bucket rdo-fotos
-- permitindo que usuários autenticados façam upload de PDFs na pasta pdfs/
CREATE POLICY "Authenticated users can upload PDFs to rdo-fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rdo-fotos'
  AND (storage.foldername(name))[1] = 'pdfs'
);

-- Também garante que possam fazer update/upsert (sobrescrever)
CREATE POLICY "Authenticated users can update PDFs in rdo-fotos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rdo-fotos'
  AND (storage.foldername(name))[1] = 'pdfs'
);
