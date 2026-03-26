
CREATE TABLE public.sidebar_menu_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key text NOT NULL UNIQUE,
  custom_label text,
  menu_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sidebar_menu_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sidebar_menu_configs"
  ON public.sidebar_menu_configs
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read sidebar_menu_configs"
  ON public.sidebar_menu_configs
  FOR SELECT
  TO authenticated
  USING (true);
