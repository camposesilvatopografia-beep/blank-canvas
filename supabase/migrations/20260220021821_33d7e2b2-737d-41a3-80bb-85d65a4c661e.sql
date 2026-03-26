
-- Adicionar campos CPF para cada aprovador em rdo_obras
ALTER TABLE public.rdo_obras
  ADD COLUMN IF NOT EXISTS aprovador1_cpf text,
  ADD COLUMN IF NOT EXISTS aprovador2_cpf text,
  ADD COLUMN IF NOT EXISTS aprovador3_cpf text;

-- Criar tabela para salvar assinaturas reutilizáveis por aprovador (por email)
CREATE TABLE IF NOT EXISTS public.rdo_saved_signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Sem RLS pois é acessada por edge function com service role
