
CREATE TABLE public.page_layout_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  block_key text NOT NULL,
  block_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, block_key)
);

ALTER TABLE public.page_layout_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage page_layout_configs"
  ON public.page_layout_configs
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read page_layout_configs"
  ON public.page_layout_configs
  FOR SELECT
  TO authenticated
  USING (true);
