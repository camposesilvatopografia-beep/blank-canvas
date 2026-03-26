
CREATE TABLE public.report_header_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key text NOT NULL,
  logo_visible boolean NOT NULL DEFAULT true,
  logo_height integer NOT NULL DEFAULT 60,
  header_padding_top integer NOT NULL DEFAULT 12,
  header_padding_bottom integer NOT NULL DEFAULT 12,
  header_padding_left integer NOT NULL DEFAULT 20,
  header_padding_right integer NOT NULL DEFAULT 20,
  title_font_size integer NOT NULL DEFAULT 18,
  subtitle_font_size integer NOT NULL DEFAULT 13,
  date_font_size integer NOT NULL DEFAULT 11,
  header_gap integer NOT NULL DEFAULT 16,
  stats_gap integer NOT NULL DEFAULT 12,
  stats_margin_bottom integer NOT NULL DEFAULT 16,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_key)
);

ALTER TABLE public.report_header_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report_header_configs"
  ON public.report_header_configs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read report_header_configs"
  ON public.report_header_configs FOR SELECT
  TO authenticated
  USING (true);
