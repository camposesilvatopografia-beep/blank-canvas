
ALTER TABLE public.obras_retigrafico
  ADD COLUMN IF NOT EXISTS area_prevista numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_prevista_termino date,
  ADD COLUMN IF NOT EXISTS prazo_previsto_dias integer,
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS contrato text,
  ADD COLUMN IF NOT EXISTS observacoes text;
