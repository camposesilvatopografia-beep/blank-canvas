
CREATE TABLE public.table_conditional_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_key text NOT NULL,
  column_key text NOT NULL,
  match_value text NOT NULL,
  bg_color text NOT NULL DEFAULT '#3b82f6',
  text_color text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.table_conditional_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage table_conditional_formats" ON public.table_conditional_formats FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read table_conditional_formats" ON public.table_conditional_formats FOR SELECT TO authenticated USING (true);
