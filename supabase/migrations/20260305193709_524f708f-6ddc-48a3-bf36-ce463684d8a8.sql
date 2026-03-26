
-- Tabela de materiais do almoxarifado
CREATE TABLE public.alm_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome text NOT NULL,
  categoria text,
  unidade text NOT NULL DEFAULT 'un',
  estoque_minimo numeric NOT NULL DEFAULT 0,
  estoque_atual numeric NOT NULL DEFAULT 0,
  observacoes text,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de movimentações (entradas e saídas)
CREATE TABLE public.alm_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'entrada',
  data date NOT NULL DEFAULT CURRENT_DATE,
  material_id uuid NOT NULL REFERENCES public.alm_materiais(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL,
  saldo_apos numeric NOT NULL DEFAULT 0,
  fornecedor text,
  nota_fiscal text,
  responsavel text,
  local_armazenamento text,
  equipe text,
  etapa_obra text,
  local_uso text,
  numero_requisicao text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.alm_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alm_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Policies alm_materiais
CREATE POLICY "Admins can manage alm_materiais" ON public.alm_materiais FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read alm_materiais" ON public.alm_materiais FOR SELECT TO authenticated USING (true);

-- Policies alm_movimentacoes
CREATE POLICY "Admins can manage alm_movimentacoes" ON public.alm_movimentacoes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read alm_movimentacoes" ON public.alm_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert alm_movimentacoes" ON public.alm_movimentacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Triggers updated_at
CREATE TRIGGER update_alm_materiais_updated_at BEFORE UPDATE ON public.alm_materiais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alm_movimentacoes_updated_at BEFORE UPDATE ON public.alm_movimentacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
