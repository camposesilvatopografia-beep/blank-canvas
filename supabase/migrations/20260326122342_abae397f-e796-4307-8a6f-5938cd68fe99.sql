
-- Add missing 'status' column to materiais
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Ativo';

-- Add missing 'tipo' column to locais (already has tipo but let's ensure)
-- locais already has tipo, just checking status consistency
