ALTER TABLE public.trechos_retigrafico 
  ADD COLUMN IF NOT EXISTS faixa text,
  ADD COLUMN IF NOT EXISTS secao text;