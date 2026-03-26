
-- Adicionar campos de email para aprovadores em rdo_obras
ALTER TABLE public.rdo_obras
  ADD COLUMN IF NOT EXISTS aprovador1_email TEXT,
  ADD COLUMN IF NOT EXISTS aprovador2_email TEXT,
  ADD COLUMN IF NOT EXISTS aprovador3_email TEXT;

-- Criar tabela para armazenar OTP tokens de aprovação
CREATE TABLE IF NOT EXISTS public.rdo_approval_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL,
  aprovador_num SMALLINT NOT NULL CHECK (aprovador_num IN (1, 2, 3)),
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  used_at TIMESTAMP WITH TIME ZONE,
  attempts SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por rdo_id e aprovador
CREATE INDEX IF NOT EXISTS idx_rdo_approval_otps_rdo_aprovador
  ON public.rdo_approval_otps(rdo_id, aprovador_num);

-- Índice para limpeza de tokens expirados
CREATE INDEX IF NOT EXISTS idx_rdo_approval_otps_expires
  ON public.rdo_approval_otps(expires_at);

-- RLS para a tabela de OTPs (apenas via service role / edge functions)
ALTER TABLE public.rdo_approval_otps ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy pública — acesso apenas pelo service role key nas edge functions
-- (a tabela é gerenciada internamente pelas edge functions com service_role)
