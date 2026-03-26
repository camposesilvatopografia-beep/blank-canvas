ALTER TABLE public.alm_movimentacoes 
ADD COLUMN preco_unitario numeric DEFAULT 0,
ADD COLUMN preco_total numeric DEFAULT 0;