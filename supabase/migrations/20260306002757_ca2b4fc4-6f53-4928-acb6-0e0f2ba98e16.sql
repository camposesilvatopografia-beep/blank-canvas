
CREATE TABLE public.table_column_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_key text NOT NULL,
  column_key text NOT NULL,
  custom_label text,
  visible boolean NOT NULL DEFAULT true,
  column_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(table_key, column_key)
);

ALTER TABLE public.table_column_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read table_column_configs"
ON public.table_column_configs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage table_column_configs"
ON public.table_column_configs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
