
-- Atualiza o bucket rdo-fotos para aceitar também PDFs
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
WHERE id = 'rdo-fotos';
