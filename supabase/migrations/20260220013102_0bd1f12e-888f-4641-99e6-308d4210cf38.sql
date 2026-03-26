
-- Adiciona colunas para armazenar o caminho das imagens de assinatura
ALTER TABLE public.rdos
  ADD COLUMN IF NOT EXISTS assinatura1_path text NULL,
  ADD COLUMN IF NOT EXISTS assinatura2_path text NULL,
  ADD COLUMN IF NOT EXISTS assinatura3_path text NULL;
