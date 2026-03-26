
-- Add missing columns to fornecedores_cal
ALTER TABLE public.fornecedores_cal ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.fornecedores_cal ADD COLUMN IF NOT EXISTS contato TEXT;

-- Add missing columns to fornecedores_pedreira
ALTER TABLE public.fornecedores_pedreira ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.fornecedores_pedreira ADD COLUMN IF NOT EXISTS contato TEXT;

-- Add missing column 'usuario' to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usuario TEXT;

-- Add missing columns to rdo_email_logs
ALTER TABLE public.rdo_email_logs ADD COLUMN IF NOT EXISTS obra_nome TEXT;
ALTER TABLE public.rdo_email_logs ADD COLUMN IF NOT EXISTS aprovador_num INTEGER;
ALTER TABLE public.rdo_email_logs ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.rdo_email_logs ADD COLUMN IF NOT EXISTS resend_id TEXT;
