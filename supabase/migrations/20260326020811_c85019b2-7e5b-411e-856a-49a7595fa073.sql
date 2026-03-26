-- Part 4: Pedreira & Permissions & Logs
CREATE TABLE IF NOT EXISTS public.materiais_pedreira (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL,
  status text DEFAULT 'Ativo'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fornecedores_pedreira (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nome text NOT NULL,
  cnpj text,
  contato text,
  status text DEFAULT 'Ativo'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_submenu_permissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submenu_key text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (user_id, submenu_key)
);

CREATE TABLE IF NOT EXISTS public.rdo_email_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  rdo_id uuid NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  obra_nome text,
  aprovador_num smallint NOT NULL,
  email text NOT NULL,
  status text DEFAULT 'success'::text NOT NULL,
  error_message text,
  resend_id text,
  sent_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  email text NOT NULL UNIQUE,
  nome text,
  tipo text DEFAULT 'Apontador'::text NOT NULL,
  status text DEFAULT 'ativo'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.materiais_pedreira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores_pedreira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_submenu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Add remaining tables from Retigrafico and others
CREATE TABLE IF NOT EXISTS public.obras_retigrafico (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    extensao_total numeric,
    estaca_inicial text,
    estaca_final text,
    planta_path text,
    status text DEFAULT 'Ativo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    area_prevista numeric DEFAULT 0,
    data_inicio date,
    data_prevista_termino date,
    prazo_previsto_dias integer,
    responsavel text,
    contrato text,
    observacoes text
);

CREATE TABLE IF NOT EXISTS public.servicos_retigrafico (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    unidade text DEFAULT 'm²'::text NOT NULL,
    status text DEFAULT 'Ativo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trechos_retigrafico (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    obra_id uuid NOT NULL REFERENCES public.obras_retigrafico(id) ON DELETE CASCADE,
    nome text NOT NULL,
    estaca_inicial numeric,
    estaca_final numeric,
    largura numeric,
    extensao numeric,
    area numeric,
    status text DEFAULT 'Ativo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.obras_retigrafico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos_retigrafico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trechos_retigrafico ENABLE ROW LEVEL SECURITY;
