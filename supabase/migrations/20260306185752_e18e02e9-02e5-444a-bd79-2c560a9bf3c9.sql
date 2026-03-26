ALTER TABLE public.alm_fornecedores ADD COLUMN IF NOT EXISTS telefone text DEFAULT NULL;
ALTER TABLE public.alm_fornecedores ADD COLUMN IF NOT EXISTS email text DEFAULT NULL;