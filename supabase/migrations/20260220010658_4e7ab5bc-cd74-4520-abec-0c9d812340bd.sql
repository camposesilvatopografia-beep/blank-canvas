
-- Add new fields to rdos table for PDF-style RDO
ALTER TABLE public.rdos
  ADD COLUMN IF NOT EXISTS precipitacao_dia numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_inicio date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS termino_previsto date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prazo_contratual integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condicao_tempo text DEFAULT 'Bom',
  ADD COLUMN IF NOT EXISTS comentarios_construtora text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comentarios_gerenciadora text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comentarios_fiscalizacao text DEFAULT NULL;
