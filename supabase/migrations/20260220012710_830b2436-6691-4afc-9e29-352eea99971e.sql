
-- Adiciona coluna para armazenar o caminho do PDF no storage
ALTER TABLE public.rdos ADD COLUMN IF NOT EXISTS pdf_path text NULL;
