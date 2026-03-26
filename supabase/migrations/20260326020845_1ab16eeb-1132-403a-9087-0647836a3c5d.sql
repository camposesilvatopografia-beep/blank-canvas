-- Part 6: Missing Tables & Columns
CREATE TABLE IF NOT EXISTS public.user_equipment_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    equipment_prefixo text NOT NULL,
    equipment_type text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (user_id, equipment_prefixo, equipment_type)
);

CREATE TABLE IF NOT EXISTS public.page_layout_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    page_key text NOT NULL,
    block_key text NOT NULL,
    block_order integer DEFAULT 0 NOT NULL,
    visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (page_key, block_key)
);

CREATE TABLE IF NOT EXISTS public.retigrafico_overlay_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    obra_id uuid NOT NULL REFERENCES public.obras_retigrafico(id) ON DELETE CASCADE,
    trecho_id uuid NOT NULL REFERENCES public.trechos_retigrafico(id) ON DELETE CASCADE,
    polygon_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.execucoes_retigrafico (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    data date DEFAULT CURRENT_DATE NOT NULL,
    obra_id uuid NOT NULL REFERENCES public.obras_retigrafico(id) ON DELETE CASCADE,
    servico_id uuid NOT NULL REFERENCES public.servicos_retigrafico(id) ON DELETE CASCADE,
    trecho_id uuid NOT NULL REFERENCES public.trechos_retigrafico(id) ON DELETE CASCADE,
    quantidade_executada numeric DEFAULT 0 NOT NULL,
    area_executada numeric DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.evolucao_obra_execucoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    estaca_inicio integer NOT NULL,
    estaca_fim integer NOT NULL,
    faixa integer NOT NULL,
    camada text NOT NULL,
    camada_numero integer DEFAULT 1 NOT NULL,
    data date DEFAULT CURRENT_DATE NOT NULL,
    area_executada numeric DEFAULT 200 NOT NULL,
    volume_executado numeric DEFAULT 0 NOT NULL,
    observacoes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pedreira_frete_materiais (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    material text NOT NULL UNIQUE,
    preco_frete numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Fix rdo_obras missing columns
ALTER TABLE public.rdo_obras 
ADD COLUMN IF NOT EXISTS licenca_canteiro DATE,
ADD COLUMN IF NOT EXISTS asv DATE,
ADD COLUMN IF NOT EXISTS data_publicacao DATE,
ADD COLUMN IF NOT EXISTS novo_prazo_contratual DATE;

-- Enable RLS
ALTER TABLE public.user_equipment_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_layout_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retigrafico_overlay_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execucoes_retigrafico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolucao_obra_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedreira_frete_materiais ENABLE ROW LEVEL SECURITY;
