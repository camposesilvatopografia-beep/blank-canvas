-- Tabela de Locais (Origem/Destino)
CREATE TABLE public.locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('Origem', 'Destino')),
  nome TEXT NOT NULL,
  obra TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Materiais
CREATE TABLE public.materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  unidade TEXT NOT NULL DEFAULT 'm³',
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Empresas
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  contato TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Fornecedores CAL
CREATE TABLE public.fornecedores_cal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores_cal ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Authenticated users can read
CREATE POLICY "Authenticated users can read locais"
ON public.locais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read materiais"
ON public.materiais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read empresas"
ON public.empresas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read fornecedores_cal"
ON public.fornecedores_cal FOR SELECT TO authenticated USING (true);

-- RLS Policies - Only admins can manage
CREATE POLICY "Admins can manage locais"
ON public.locais FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage materiais"
ON public.materiais FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage empresas"
ON public.empresas FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage fornecedores_cal"
ON public.fornecedores_cal FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_locais_updated_at
BEFORE UPDATE ON public.locais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_materiais_updated_at
BEFORE UPDATE ON public.materiais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fornecedores_cal_updated_at
BEFORE UPDATE ON public.fornecedores_cal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();