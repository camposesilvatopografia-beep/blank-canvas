
ALTER TABLE public.table_column_configs
  ADD COLUMN icon_name text DEFAULT NULL,
  ADD COLUMN text_align text DEFAULT NULL,
  ADD COLUMN font_italic boolean NOT NULL DEFAULT false,
  ADD COLUMN text_transform text DEFAULT NULL,
  ADD COLUMN letter_spacing text DEFAULT NULL;
