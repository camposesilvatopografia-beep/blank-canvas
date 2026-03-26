
CREATE TABLE public.alm_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  contato text,
  observacoes text,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alm_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alm_fornecedores" ON public.alm_fornecedores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read alm_fornecedores" ON public.alm_fornecedores
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE public.alm_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  responsavel text,
  observacoes text,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alm_setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alm_setores" ON public.alm_setores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read alm_setores" ON public.alm_setores
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE public.alm_locais_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alm_locais_uso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alm_locais_uso" ON public.alm_locais_uso
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read alm_locais_uso" ON public.alm_locais_uso
  FOR SELECT TO authenticated
  USING (true);
