-- Adiciona colunas de observação por aprovador na tabela rdos
ALTER TABLE public.rdos
  ADD COLUMN IF NOT EXISTS aprovacao1_observacao text,
  ADD COLUMN IF NOT EXISTS aprovacao2_observacao text,
  ADD COLUMN IF NOT EXISTS aprovacao3_observacao text;
