
CREATE TABLE public.pedreira_frete_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material text NOT NULL UNIQUE,
  preco_frete numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedreira_frete_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pedreira_frete_materiais"
  ON public.pedreira_frete_materiais FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read pedreira_frete_materiais"
  ON public.pedreira_frete_materiais FOR SELECT
  TO authenticated
  USING (true);
