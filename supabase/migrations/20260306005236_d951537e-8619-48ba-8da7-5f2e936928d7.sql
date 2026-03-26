
ALTER TABLE public.table_column_configs
  ADD COLUMN text_color text DEFAULT NULL,
  ADD COLUMN bg_color text DEFAULT NULL,
  ADD COLUMN font_family text DEFAULT NULL,
  ADD COLUMN font_bold boolean NOT NULL DEFAULT false,
  ADD COLUMN font_size text DEFAULT NULL;
