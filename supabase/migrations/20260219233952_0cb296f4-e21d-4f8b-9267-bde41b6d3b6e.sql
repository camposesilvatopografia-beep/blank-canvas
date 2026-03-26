
-- Create RDO (Relatório Diário de Obra) tables

-- RDO configurations (obras/projects)
CREATE TABLE public.rdo_obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  contrato TEXT,
  cliente TEXT,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  -- 3 approvers
  aprovador1_nome TEXT,
  aprovador1_whatsapp TEXT,
  aprovador1_cargo TEXT,
  aprovador2_nome TEXT,
  aprovador2_whatsapp TEXT,
  aprovador2_cargo TEXT,
  aprovador3_nome TEXT,
  aprovador3_whatsapp TEXT,
  aprovador3_cargo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Daily RDO entries
CREATE TABLE public.rdos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.rdo_obras(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  numero_rdo TEXT,
  created_by UUID NOT NULL,
  -- Weather conditions
  clima_manha TEXT DEFAULT 'Bom', -- Bom, Nublado, Chuvoso, Parcialmente Nublado
  clima_tarde TEXT DEFAULT 'Bom',
  temperatura_manha NUMERIC,
  temperatura_tarde NUMERIC,
  -- Status
  status TEXT NOT NULL DEFAULT 'Rascunho', -- Rascunho, Aguardando Aprovação, Aprovado Parcialmente, Aprovado, Reprovado
  -- Observations
  observacoes TEXT,
  -- Approval tracking
  aprovacao1_status TEXT DEFAULT 'Pendente', -- Pendente, Aprovado, Reprovado
  aprovacao1_data TIMESTAMP WITH TIME ZONE,
  aprovacao1_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  aprovacao2_status TEXT DEFAULT 'Pendente',
  aprovacao2_data TIMESTAMP WITH TIME ZONE,
  aprovacao2_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  aprovacao3_status TEXT DEFAULT 'Pendente',
  aprovacao3_data TIMESTAMP WITH TIME ZONE,
  aprovacao3_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Workforce (efetivo) records per RDO
CREATE TABLE public.rdo_efetivo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL,
  funcao TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  periodo TEXT DEFAULT 'Dia Completo', -- Dia Completo, Manhã, Tarde
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Equipment records per RDO
CREATE TABLE public.rdo_equipamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  equipamento TEXT NOT NULL,
  prefixo TEXT,
  horas_trabalhadas NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Operando', -- Operando, Parado, Manutenção
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Services/activities per RDO
CREATE TABLE public.rdo_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  local_servico TEXT,
  unidade TEXT,
  quantidade_prevista NUMERIC,
  quantidade_executada NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rdo_obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_efetivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_servicos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rdo_obras
CREATE POLICY "Authenticated can read rdo_obras" ON public.rdo_obras FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage rdo_obras" ON public.rdo_obras FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for rdos
CREATE POLICY "Authenticated can read rdos" ON public.rdos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert rdos" ON public.rdos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);
CREATE POLICY "Owner or admin can update rdos" ON public.rdos FOR UPDATE USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete rdos" ON public.rdos FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for rdo_efetivo
CREATE POLICY "Authenticated can read rdo_efetivo" ON public.rdo_efetivo FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can manage rdo_efetivo" ON public.rdo_efetivo FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for rdo_equipamentos
CREATE POLICY "Authenticated can read rdo_equipamentos" ON public.rdo_equipamentos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can manage rdo_equipamentos" ON public.rdo_equipamentos FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for rdo_servicos
CREATE POLICY "Authenticated can read rdo_servicos" ON public.rdo_servicos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can manage rdo_servicos" ON public.rdo_servicos FOR ALL USING (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_rdo_obras_updated_at BEFORE UPDATE ON public.rdo_obras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rdos_updated_at BEFORE UPDATE ON public.rdos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
