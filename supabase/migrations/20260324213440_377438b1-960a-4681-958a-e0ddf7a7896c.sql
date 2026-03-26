
CREATE TABLE public.evolucao_obra_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estaca_inicio integer NOT NULL,
  estaca_fim integer NOT NULL,
  faixa integer NOT NULL,
  camada text NOT NULL,
  camada_numero integer NOT NULL DEFAULT 1,
  data date NOT NULL DEFAULT CURRENT_DATE,
  area_executada numeric NOT NULL DEFAULT 200,
  volume_executado numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estaca_inicio, faixa, camada, camada_numero)
);

ALTER TABLE public.evolucao_obra_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage evolucao_obra_execucoes" ON public.evolucao_obra_execucoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read evolucao_obra_execucoes" ON public.evolucao_obra_execucoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert evolucao_obra_execucoes" ON public.evolucao_obra_execucoes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.evolucao_obra_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
