-- Part 2 & 3: RDO & Almoxarifado
CREATE TABLE IF NOT EXISTS public.rdo_obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  contrato TEXT,
  cliente TEXT,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  aprovador1_nome TEXT, aprovador1_whatsapp TEXT, aprovador1_cargo TEXT, aprovador1_email TEXT, aprovador1_cpf TEXT,
  aprovador2_nome TEXT, aprovador2_whatsapp TEXT, aprovador2_cargo TEXT, aprovador2_email TEXT, aprovador2_cpf TEXT,
  aprovador3_nome TEXT, aprovador3_whatsapp TEXT, aprovador3_cargo TEXT, aprovador3_email TEXT, aprovador3_cpf TEXT,
  objeto TEXT, licenca_ambiental DATE, outorgas_agua TEXT,
  dias_aditados INTEGER DEFAULT 0, dias_paralisados INTEGER DEFAULT 0,
  data_inicio_contrato DATE, prazo_contratual_dias INTEGER, data_prazo_contratual DATE,
  vigencia_inicial DATE, vigencia_final DATE,
  usina_cbuq BOOLEAN DEFAULT FALSE, usina_solos BOOLEAN DEFAULT FALSE, usina_concreto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rdos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.rdo_obras(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  numero_rdo TEXT,
  created_by UUID NOT NULL,
  clima_manha TEXT DEFAULT 'Bom', clima_tarde TEXT DEFAULT 'Bom',
  temperatura_manha NUMERIC, temperatura_tarde NUMERIC,
  status TEXT NOT NULL DEFAULT 'Rascunho',
  observacoes TEXT,
  aprovacao1_status TEXT DEFAULT 'Pendente', aprovacao1_data TIMESTAMP WITH TIME ZONE, aprovacao1_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT, aprovacao1_observacao TEXT,
  aprovacao2_status TEXT DEFAULT 'Pendente', aprovacao2_data TIMESTAMP WITH TIME ZONE, aprovacao2_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT, aprovacao2_observacao TEXT,
  aprovacao3_status TEXT DEFAULT 'Pendente', aprovacao3_data TIMESTAMP WITH TIME ZONE, aprovacao3_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT, aprovacao3_observacao TEXT,
  precipitacao_dia NUMERIC DEFAULT 0, precipitacao_acumulada_mes NUMERIC DEFAULT 0,
  data_inicio DATE, termino_previsto DATE, prazo_contratual INTEGER,
  prazo_decorrido INTEGER, prazo_restante INTEGER, prazo_restante_vigencia INTEGER,
  condicao_tempo TEXT DEFAULT 'Bom',
  comentarios_construtora TEXT, comentarios_gerenciadora TEXT, comentarios_fiscalizacao TEXT,
  pdf_path TEXT, assinatura1_path TEXT, assinatura2_path TEXT, assinatura3_path TEXT,
  novo_prazo_contratual DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rdo_efetivo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL, funcao TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1,
  periodo TEXT DEFAULT 'Dia Completo', created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rdo_equipamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  equipamento TEXT NOT NULL, prefixo TEXT, horas_trabalhadas NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Operando', observacao TEXT, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rdo_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL, local_servico TEXT, unidade TEXT,
  quantidade_prevista NUMERIC, quantidade_executada NUMERIC, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rdo_fotos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, legenda TEXT, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_efetivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_fotos ENABLE ROW LEVEL SECURITY;

-- Almoxarifado (Already partially defined, completing now)
CREATE TABLE IF NOT EXISTS public.alm_materiais (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  codigo text NOT NULL UNIQUE, nome text NOT NULL, categoria text,
  unidade text DEFAULT 'un'::text NOT NULL, estoque_minimo numeric DEFAULT 0 NOT NULL,
  estoque_atual numeric DEFAULT 0 NOT NULL, observacoes text, status text DEFAULT 'Ativo'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  foto_path text
);

CREATE TABLE IF NOT EXISTS public.alm_movimentacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  tipo text DEFAULT 'entrada'::text NOT NULL, data date DEFAULT CURRENT_DATE NOT NULL,
  material_id uuid NOT NULL REFERENCES public.alm_materiais(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL, saldo_apos numeric DEFAULT 0 NOT NULL,
  fornecedor text, nota_fiscal text, responsavel text, local_armazenamento text,
  equipe text, etapa_obra text, local_uso text, numero_requisicao text,
  observacoes text, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  preco_unitario numeric DEFAULT 0, preco_total numeric DEFAULT 0,
  foto_path text, nf_foto_path text
);

ALTER TABLE public.alm_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alm_movimentacoes ENABLE ROW LEVEL SECURITY;
